# Déploiement staging

Ce document décrit le premier déploiement cloud **sans Docker local**. Le PC de
développement reste sur SQLite ; le staging utilise PostgreSQL pour les
métadonnées et un volume persistant pour les données applicatives.

## Architecture staging v1

```text
Internet
  └─ HTTPS (domaine staging)
       └─ conteneur Next.js (1 instance)
            ├─ PostgreSQL managé  ← users, projets, crédits, jobs, sync records
            ├─ volume persistant  ← workspaces/, .faya/app.db, artefacts
            └─ génération IA      ← worker tsx sur la même instance
```

Limites assumées de cette v1 :

- **une seule instance** : rate limit et SSE sont en mémoire ;
- **données applicatives en SQLite** sur volume, pas encore libSQL ;
- **stockage local** sur volume, pas encore S3/R2 ;
- **exports Tauri** nécessitent un agent Windows, pas encore automatisé.

C'est un staging de validation, pas la cible de production finale.

## Services à provisionner

| Service | Recommandation | Rôle |
| --- | --- | --- |
| PostgreSQL | Neon, Supabase ou Railway | métadonnées plateforme |
| Hébergement | Fly.io, Render ou Railway | conteneur Next.js |
| Volume | volume persistant de l'hébergeur | workspaces et bases projet |
| Build Windows | ce PC ou VM Windows | exports Tauri |
| Domaine | sous-domaine staging | HTTPS, cookies secure |

Redis et S3 ne sont pas nécessaires pour cette v1. Ils le deviendront avec les
adaptateurs correspondants.

## Variables d'environnement

Partir de [`staging.env.example`](staging.env.example) :

```env
DATABASE_URL=postgresql://...
FAYA_PROFILE=staging
FAYA_PLATFORM_URL=https://staging.example.com
DEEPSEEK_API_KEY=...
PROJECT_DATA_PROVIDER=sqlite
RATE_LIMITER=memory
EVENT_BUS=memory
JOB_DISPATCHER=process
STORAGE_PROVIDER=local
```

`NODE_ENV=production` est positionné par l'image. `FAYA_PLATFORM_URL` doit être
l'URL HTTPS publique, car elle est gravée dans les exports.

## Base PostgreSQL

Le schéma PostgreSQL est généré depuis le schéma SQLite pour éviter la dérive :

```bash
npm run prisma:prepare-postgres
npx prisma validate --schema prisma/postgres/schema.prisma
```

Le client Prisma doit être généré pour PostgreSQL **dans l'image de staging** :

```bash
npm run prisma:generate:postgres
```

Premier provisionnement (staging uniquement) :

```bash
npm run db:push:postgres
```

`db push` est acceptable pour un staging initial. Pour la production, générer
une migration versionnée et utiliser `prisma migrate deploy`.

## Image et déploiement

Le `Dockerfile` à la racine :

- installe les dépendances ;
- génère le schéma et le client Prisma PostgreSQL ;
- construit Next.js ;
- expose le port 3000 ;
- monte `workspaces/` comme volume.

Exemple Fly.io :

```bash
fly launch --no-deploy
fly volumes create faya_workspaces --size 10
fly secrets set DATABASE_URL=... DEEPSEEK_API_KEY=... FAYA_PLATFORM_URL=...
fly deploy
```

Render/Railway : utiliser le `Dockerfile`, ajouter un disque persistant monté
sur `/app/workspaces`, et les mêmes secrets.

## Vérifications après déploiement

```bash
curl https://staging.example.com/api/health
```

Réponse attendue : `{"ok":true,"db":"ok",...}`.

Puis :

```bash
E2E_REMOTE=1 \
E2E_BASE_URL=https://staging.example.com \
E2E_PROJECT_ID=<projet fixture> \
E2E_APP_KEY=fs_... \
E2E_EMAIL=<compte test> \
E2E_PASSWORD=<secret> \
npm run e2e
```

Le projet fixture et sa clé doivent être créés dans le staging. Le mode distant
se connecte réellement via `/login` et ne supprime rien.

## Données et sauvegardes

- PostgreSQL : sauvegarde managée + PITR si disponible.
- Volume : snapshots réguliers de `workspaces/`.
- Tester une restauration avant d'ouvrir le staging à des utilisateurs.
- Ne jamais copier les données de production vers le staging.

## Exports Tauri

Sur Linux, `enqueueBuild` échoue volontairement avec un message explicite :

> Desktop exports require a Windows build agent.

Trois options :

1. héberger le staging sur une machine Windows (simple, moins courant) ;
2. garder ce PC comme agent de build manuel ;
3. implémenter `JOB_DISPATCHER=postgres` + un worker Windows qui claim les
   `BuildJob` et uploade l'artefact.

L'option 3 est la cible. En attendant, désactiver ou assumer les exports sur le
staging Linux.

## Prochaines étapes après la v1

- adaptateur libSQL/Turso pour les données projet ;
- Redis pour rate limit et SSE multi-instance ;
- S3/R2 pour les workspaces et artefacts ;
- agent Windows de build ;
- migrations PostgreSQL versionnées ;
- observabilité centralisée et alertes.
