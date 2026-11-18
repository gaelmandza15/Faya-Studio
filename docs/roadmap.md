# Feuille de route — de la plateforme locale au déploiement

Ce document fixe l'ordre de construction de la suite. Il part de trois
contraintes :

- le développement continue sur un PC Windows **sans Docker** ;
- la cible est un déploiement multi-utilisateurs, pas cette machine ;
- les builds Tauri Windows restent une brique spécifique.

## État actuel

Déjà en place et testé :

- auth, organisations, rôles, invitations ;
- projets, génération IA, modifications, versions et rollback ;
- crédits, exports Tauri, publication web ;
- fiche application complète ;
- mode Exécution `/app/[id]` avec Web Bridge SQLite ;
- synchronisation local ↔ plateforme, appareils et clés ;
- webhooks signés ;
- rate limit, SSE, SQL guard ;
- checklist de finition UI et audit statique ;
- harnais Playwright desktop + mobile ;
- documentation.

Ce qui reste local-only :

- SQLite par projet sur disque ;
- workspaces et artefacts sur le système de fichiers ;
- rate limit et SSE en mémoire ;
- workers `tsx` détachés ;
- builds Tauri sur ce PC.

## Principes

1. **Ne pas bloquer le local avec l'infrastructure.** Les adaptateurs locaux
   restent le défaut.
2. **Abstractiser avant de migrer.** On remplace les implémentations, pas les
   contrats.
3. **Cloud sans Docker.** Services managés + binaires natifs si nécessaire.
4. **Le SQL des applications générées reste SQLite.** On ne réécrit pas le
   dialecte produit par l'IA.
5. **Une phase = un critère d'acceptation mesurable.**

## Décision structurante : où vivent les données des applications

Trois options :

| Option | Avantages | Inconvénients |
| --- | --- | --- |
| **libSQL / Turso par projet** | SQLite-compatible, le SQL généré fonctionne tel quel, managé, pas de Docker | latence réseau par requête, coût par base, transactions distantes |
| PostgreSQL, un schéma par projet | un seul moteur, robuste, requêtes analytiques | il faut traduire le dialecte SQLite généré (`AUTOINCREMENT`, `datetime('now')`, `INSERT OR IGNORE`, `?1`) |
| PostgreSQL, tables partagées + JSONB | simple à héberger | incompatible avec le contrat SQL générique du Web Bridge |

**Recommandation : libSQL/Turso pour les données applicatives**, et
PostgreSQL pour les métadonnées de la plateforme (users, projets, crédits,
jobs, sync records). Cela préserve le contrat `db_select` / `db_execute` et
évite un chantier de traduction SQL.

Décision à confirmer avant la phase 2 par un ADR.

## Phase 0 — Stabilisation (livrée)

Objectif : rendre l'existant observable et reproductible avant de l'étendre.

Livré :

- `GET /api/health` (app + base, 200/503, `x-request-id`, `no-store`) ;
- logs JSON structurés avec `requestId`, `projectId`, `jobId`, `userId` dans
  les routes web, la sync et les workers ;
- validation stricte de l'environnement au démarrage (`src/lib/env.ts`,
  `next.config.ts`) ;
- workflow CI prêt dans `docs/ci/ci-workflow.yml` et workflow E2E dans
  `docs/ci/e2e-workflow.yml` (activation manuelle : le token GitHub doit avoir
  le scope `workflow`) ;
- warmup des routes avant la suite Playwright pour éviter les timeouts de
  compilation à froid ;
- `README` et documentation mis à jour.

Reste optionnel : iPhone/WebKit et petit mobile 360 px.

**Acceptation** : health check fonctionnel, lint/tsc/build et 10 tests E2E
passent.

## Phase 1 — Abstractions de production (socle livré)

Objectif : pouvoir changer d'infrastructure sans toucher aux routes métier.

### Livré

- `ProjectDataProvider` avec adaptateur SQLite local ; les routes du Web Bridge
  et de la synchronisation ne parlent plus directement à `node:sqlite`.
- `RateLimiter` avec adaptateur mémoire et factory `RATE_LIMITER`.
- `ProjectEventBus` avec adaptateur mémoire et factory `EVENT_BUS`.
- `JobDispatcher` avec adaptateur processus et factory `JOB_DISPATCHER`.
- Profils `FAYA_PROFILE` et variables de providers validées par `env.ts`.
- Documentation [`docs/providers.md`](providers.md).

### Reste à faire

- `StorageProvider` : fichiers locaux ↔ S3/R2 ;
- adaptateurs libSQL, Redis et Postgres ;
- chiffrement au repos des clés d'application et secrets webhook ;
- tests d'intégration par adaptateur ;
- migration Prisma des métadonnées vers PostgreSQL.

**Acceptation** : la suite E2E locale passe sans changement ; aucun route
handler ne connaît l'implémentation ; un provider non implémenté échoue
explicitement.

## Phase 2 — Staging cloud (préparation livrée)

Objectif : valider la plateforme dans des conditions réelles.

### Livré

- schéma Prisma PostgreSQL généré depuis la source SQLite
  (`scripts/prepare-postgres-schema.ts`) et validé ;
- scripts `prisma:generate:postgres`, `db:push:postgres`, `db:seed:postgres` ;
- `Dockerfile` multi-stage pour un hébergement Linux ;
- `docs/deploy/staging.md` et `staging.env.example` ;
- mode E2E distant `E2E_REMOTE=1` avec login réel ;
- garde-fou explicite : un export Tauri sur Linux échoue avec un message
  demandant un agent Windows.

### Reste à faire (nécessite des comptes/credentials)

- provisionner PostgreSQL managé et le volume persistant ;
- construire et pousser l'image sur Fly/Render/Railway ;
- configurer le domaine, HTTPS et les cookies `secure` ;
- créer le projet fixture et le compte de test sur le staging ;
- exécuter `E2E_REMOTE=1` contre le staging ;
- tester une sauvegarde/restauration ;
- agent Windows de build ;
- adaptateurs libSQL, Redis, S3 et SSE multi-instance.

**Acceptation cible (après déploiement)** :

- deux instances voient les mêmes données et reçoivent les mêmes événements ;
- un redémarrage ne perd ni workspace ni artefact ;
- les E2E distants passent sur le staging ;
- un build Tauri est produit par l'agent Windows et téléchargeable.

## Phase 3 — Cycle de vie des applications (en cours)

Objectif : tenir la promesse « application liée, mise à jour, partagée ».

### 3.6 Porte de qualité d'exécution — livrée

- `acceptance.json` exécuté dans le document réel du runner, Web Bridge inclus ;
- base jetable par exécution (`.faya/sandbox/`), donc aucune écriture dans les
  données réelles ni dans le flux de synchronisation ;
- échecs renvoyés à l'agent dans la même session, deux tentatives de réparation
  maximum ;
- résultat persisté sur le projet et affiché dans la carte **Qualité** de la
  fiche application, avec relance manuelle ;
- repli statique explicite si la plateforme est injoignable.

Voir [`docs/acceptance.md`](acceptance.md). Limite : un échec après réparation
ne bloque pas la génération, il est signalé.

La suite de cette phase : utilisateurs et permissions au niveau de chaque
application, puis mises à jour automatiques.

### 3.5 Sauvegardes et restauration — première version livrée

- snapshot SQLite côté plateforme (`VACUUM INTO`) ;
- téléchargement authentifié ;
- restauration avec sauvegarde de sécurité `pre-restore` ;
- rétention de 20 sauvegardes ;
- blocage de la restauration tant que la synchronisation desktop est active ;
- UI sur la fiche application et test E2E dédié.

Limites : les postes desktop et `SyncRecord` ne sont pas sauvegardés ; pas
encore de stockage objet ni de planification.

### 3.1 Mises à jour automatiques — à venir

- updater Tauri signé ;
- endpoint de manifeste de version ;
- artefacts versionnés sur stockage objet ;
- déploiement progressif et rollback.

Prérequis : agent Windows de build et clés de signature.

### 3.2 Version navigateur connectée — à venir

- le runner web et l'EXE utilisent le même flux de synchronisation ;
- publication d'une application synchronisée (et non plus seulement une copie
  figée) ;
- gestion de session et de rôles côté web.

### 3.3 Utilisateurs et permissions dans l'application — à venir

- comptes applicatifs ou réutilisation des membres de l'organisation ;
- rôles par application ;
- sessions et permissions côté desktop comme côté web ;
- audit des accès.

### 3.4 Webhooks entrants et API — livré (première version)

- `POST /api/hooks/in` authentifié par clé d'application ;
- change unique ou lot `{ changes: [...] }`, même validation que la sync ;
- écriture dans `SyncRecord`, base plateforme et diffusion SSE
  `external_write` ;
- rate limit 240 req/min par application ;
- documentation et test E2E dédié.

Reste : spécification OpenAPI, en-tête d'idempotence explicite, connecteurs
préconstruits Zapier/Make.

**Acceptation cible** : un utilisateur peut mettre à jour une app installée,
ouvrir la même app dans le navigateur, inviter un collaborateur avec un rôle,
recevoir un événement externe, et restaurer une sauvegarde.

## Phase 4 — Exploitation et scale (continu)

- observabilité : métriques, traces, alertes, Sentry ;
- quotas par plan : projets, membres, builds, crédits, stockage ;
- facturation (Stripe) et périodes de grâce ;
- rate limiting distribué et protection anti-abus ;
- file d'attente prioritaire et limites de concurrence ;
- tests de charge et plan de capacité ;
- audit log, conformité, RGPD ;
- isolation renforcée de l'iframe (origine séparée + jeton scopé).

## Phase 5 — Distribution (plus tard)

- export APK par injection dans un squelette précompilé ;
- marketplace de modèles et d'applications ;
- variantes de design ;
- écosystème inter-applications ;
- connecteurs natifs (WhatsApp, e-mail, paiements).

## Ordre immédiat (7 jours)

1. Activer le workflow CI (copie dans `.github/workflows/`).
2. Ajouter `/api/health` et les logs structurés.
3. Créer les interfaces `StorageProvider`, `ProjectDataProvider`,
   `RateLimiter`, `ProjectEvents`, `JobQueue` avec leurs adaptateurs locaux.
4. Chiffrer les secrets applicatifs.
5. Écrire l'ADR « données applicatives : libSQL vs Postgres ».
6. Étendre les E2E : iPhone/WebKit, 360 px, laptop 1366 × 768.

## Ce qu'on ne fait pas maintenant

- migrer vers PostgreSQL sans avoir figé le stockage des données applicatives ;
- déployer en production avant la phase 2 ;
- installer Docker ou une infrastructure locale complexe ;
- ajouter l'APK ou la marketplace avant que le cycle de vie web/desktop soit
  stable.

## Risques suivis

| Risque | Mitigation |
| --- | --- |
| dialecte SQLite incompatible avec Postgres | libSQL/Turso, décision ADR |
| SSE/rate limit cassés en multi-instance | Redis ou LISTEN/NOTIFY |
| builds Windows impossibles sur Linux | agent Windows dédié |
| fuite de clés applicatives | chiffrement au repos, rotation, audit |
| iframe same-origin | origine séparée + jeton scopé |
| coût du stockage par projet | quotas, archivage, compression |
| régressions de finition UI | checklist + E2E + audit statique |
