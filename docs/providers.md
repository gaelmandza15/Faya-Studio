# Providers et adaptateurs

La phase 1 introduit les contrats qui permettront de passer du local au cloud
sans réécrire les routes métier. Les adaptateurs cloud ne sont pas encore
livrés : sélectionner un provider non implémenté échoue explicitement.

## Contrats livrés

| Contrat | Fichier | Adaptateur local | Adaptateur cloud prévu |
| --- | --- | --- | --- |
| `ProjectDataProvider` | `src/engine/project-db.ts` | SQLite via `node:sqlite` | libSQL/Turso |
| `RateLimiter` | `src/lib/rate-limit.ts` | fenêtre glissante en mémoire | Redis/Upstash |
| `ProjectEventBus` | `src/lib/project-events.ts` | registre mémoire `globalThis` | Redis pub/sub ou Postgres LISTEN/NOTIFY |
| `JobDispatcher` | `src/engine/job-dispatcher.ts` | processus `tsx` détaché | table Postgres + worker |
| `StorageProvider` | à extraire | système de fichiers | S3/R2 |

## Configuration

```env
FAYA_PROFILE=local
PROJECT_DATA_PROVIDER=sqlite
RATE_LIMITER=memory
EVENT_BUS=memory
JOB_DISPATCHER=process
STORAGE_PROVIDER=local
```

`src/lib/env.ts` valide ces valeurs. Si `FAYA_PROFILE` n'est pas `local` et
qu'un adaptateur local reste sélectionné, un avertissement est émis.

Les factories lisent `process.env` et lèvent une erreur explicite si le
provider demandé n'existe pas encore :

```text
Project data provider "libsql" is not implemented. Use PROJECT_DATA_PROVIDER=sqlite.
```

Ce comportement est volontaire : aucun repli silencieux vers le local en
production.

## ProjectDataProvider

```ts
interface ProjectDataProvider {
  select(query, params): Promise<Record<string, unknown>[]>;
  execute(query, params): Promise<{ changes: number; lastInsertRowid: number }>;
  snapshot(table): Promise<TableSnapshot | null>;
  applyChange(change): Promise<boolean>;
}
```

Le Web Bridge et la synchronisation desktop passent uniquement par ce contrat.
Ils ne connaissent plus `node:sqlite` directement.

Point d'attention pour libSQL : les requêtes générées sont du dialecte SQLite.
C'est précisément pourquoi libSQL/Turso est recommandé plutôt qu'une traduction
vers PostgreSQL.

## RateLimiter

```ts
interface RateLimiter {
  check(identifier, { windowMs, max }): RateLimitResult;
}
```

L'implémentation mémoire reste process-local. En multi-instance, un adaptateur
Redis devra partager les compteurs. Les routes continuent d'appeler
`rateLimit(...)`, qui délègue au provider configuré.

## ProjectEventBus

```ts
interface ProjectEventBus {
  subscribe(projectId, listener): () => void;
  broadcast(projectId, payload): void;
}
```

Le registre mémoire est partagé entre bundles via `globalThis`. En
multi-instance, Redis pub/sub ou Postgres LISTEN/NOTIFY devra diffuser les
événements entre processus. Le plafond de 5 connexions SSE par
utilisateur/projet reste local pour l'instant.

## JobDispatcher

```ts
interface JobDispatcher {
  dispatchGeneration(projectId, job): Promise<void>;
  dispatchBuild(projectId, job): Promise<void>;
}
```

L'adaptateur `process` conserve le comportement actuel : worker `tsx` détaché,
logs dans `workspaces/.logs`, remboursement de crédits si le spawn échoue.

L'adaptateur Postgres devra :

- créer ou réclamer un job avec `FOR UPDATE SKIP LOCKED` ;
- maintenir un lease et un heartbeat ;
- gérer les tentatives et les remboursements de façon idempotente ;
- exposer un worker séparé pour la génération et un agent Windows pour Tauri.

## Ce qui reste en phase 1

- `StorageProvider` : extraire les accès workspaces/artefacts et fournir un
  adaptateur S3/R2 ;
- chiffrement au repos des clés d'application et secrets webhook ;
- adaptateurs libSQL, Redis et Postgres ;
- tests d'intégration par adaptateur ;
- migration Prisma vers PostgreSQL pour les métadonnées.
