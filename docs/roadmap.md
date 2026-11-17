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

## Phase 1 — Abstractions de production (2 à 3 semaines)

Objectif : pouvoir changer d'infrastructure sans toucher aux routes métier.

### 1.1 Stockage

`StorageProvider` :

- `LocalStorageProvider` (défaut, système de fichiers) ;
- `S3StorageProvider` (R2/S3) pour les workspaces, publications et artefacts.

Contrat : `read`, `write`, `list`, `remove`, `stat`, `signedUrl`.

### 1.2 Données applicatives

`ProjectDataProvider` :

- `SqliteProjectDataProvider` (local, `node:sqlite`) ;
- `LibsqlProjectDataProvider` (cloud, Turso).

Contrat : `select`, `execute`, `snapshot`, `applyChange`.

### 1.3 Événements et limites

- `RateLimiter` : mémoire ↔ Redis (Upstash).
- `ProjectEvents` : registre local ↔ Redis pub/sub.
- `JobQueue` : processus détaché ↔ table Postgres avec
  `SELECT ... FOR UPDATE SKIP LOCKED` et leases.

### 1.4 Secrets

- chiffrement au repos des clés d'application et secrets webhook ;
- rotation documentée ;
- aucune clé dans les logs.

### 1.5 Configuration

- profils `local`, `staging`, `production` ;
- aucune dépendance à Docker ;
- valeurs par défaut locales identiques au comportement actuel.

**Acceptation** : la suite E2E locale passe sans changement ; les adaptateurs
cloud ont des tests d'intégration séparés ; aucun route handler ne connaît
l'implémentation.

## Phase 2 — Staging cloud (2 à 3 semaines)

Objectif : valider la plateforme dans des conditions réelles.

Services recommandés, sans Docker :

- **PostgreSQL managé** (Neon/Supabase/Railway) pour les métadonnées ;
- **Turso/libSQL** pour les bases par projet ;
- **Cloudflare R2** ou S3 pour les fichiers ;
- **Upstash Redis** pour rate limit et SSE (ou Postgres LISTEN/NOTIFY en
  premier jet) ;
- **application** sur Fly.io/Render/Vercel ;
- **agent Windows** pour les builds Tauri : ce PC au début, puis VM dédiée.

À faire :

- migration Prisma `sqlite → postgres` pour les métadonnées ;
- provisioning d'une base libSQL par projet ;
- upload/download des workspaces via stockage objet ;
- worker de génération qui claim les jobs en base ;
- SSE multi-instance ;
- domaine, HTTPS, cookies `secure` ;
- `E2E_REMOTE=1` contre le staging ;
- sauvegardes et restauration testées.

**Acceptation** :

- deux instances applicatives voient les mêmes données et reçoivent les mêmes
  événements ;
- un redémarrage ne perd ni workspace ni artefact ;
- les E2E distants passent sur le staging ;
- un build Tauri est produit par l'agent Windows et téléchargeable.

## Phase 3 — Cycle de vie des applications (3 à 4 semaines)

Objectif : tenir la promesse « application liée, mise à jour, partagée ».

### 3.1 Mises à jour automatiques

- updater Tauri signé ;
- endpoint de manifeste de version ;
- artefacts versionnés sur stockage objet ;
- déploiement progressif et rollback.

### 3.2 Version navigateur connectée

- le runner web et l'EXE utilisent le même flux de synchronisation ;
- publication d'une application synchronisée (et non plus seulement une copie
  figée) ;
- gestion de session et de rôles côté web.

### 3.3 Utilisateurs et permissions dans l'application

- comptes applicatifs ou réutilisation des membres de l'organisation ;
- rôles par application ;
- sessions et permissions côté desktop comme côté web ;
- audit des accès.

### 3.4 Webhooks entrants et API

- endpoint d'ingestion avec clé et idempotence ;
- écriture dans la base projet + `SyncRecord` ;
- documentation OpenAPI ;
- connecteurs universels (n8n, Make, Zapier).

### 3.5 Sauvegardes et restauration

- export/import d'une base projet ;
- sauvegardes centralisées ;
- restauration après incident ;
- rétention configurable.

**Acceptation** : un utilisateur peut mettre à jour une app installée, ouvrir
la même app dans le navigateur, inviter un collaborateur avec un rôle, et
recevoir un événement externe.

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
