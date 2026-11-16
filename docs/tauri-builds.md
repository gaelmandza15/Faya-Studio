# Production Tauri builds

Faya-Studio generates business apps that can be exported as Windows desktop
applications. This document describes the target architecture for that export.
The current repository contains a working proof: the fixed template in
`templates/tauri-v2-sqlite`, the local `BuildRunner`, `npm run tauri:proof`, and
the editor export pipeline described below.

## Export pipeline in this repository

The editor's **Export** dialog starts a real desktop build:

1. `exportProjectAction` checks that the project belongs to the active
   organization and is ready.
2. `enqueueBuild` creates a `BuildJob` (status `queued`) and spawns
   `scripts/build-worker.ts` as a detached Node process.
3. The worker copies the Tauri template and the generated frontend into
   `workspaces/.build-jobs/<jobId>`, then overrides
   `src-tauri/migrations/schema.sql` with the project's
   `desktop-schema.sql` (root first, then
   `.faya/desktop-schema.sql`), and calls `BuildRunner`.
4. The resulting binary is copied to
   `workspaces/.artifacts/<jobId>/<app-name>.exe`, checked with `--self-test`,
   and recorded on the `BuildJob` row.
5. The dialog polls `/api/projects/[id]/builds`; the download button hits
   `/api/builds/[id]/download`, which re-checks the session and organization
   membership before streaming the file.

## Desktop generation profile

New projects are generated with `target = "desktop"`. The engine produces four
artifacts:

- `desktop-schema.sql`: tables, constraints, indexes and seed rows;
- `db.js`: a `window.FayaDB` data layer that calls `db_select` / `db_execute`
  under Tauri and falls back to namespaced localStorage in the browser preview;
- `app.js`: no direct storage access, all reads/writes go through `FayaDB`;
- `index.html`: loads `db.js` before `app.js`.

Before a project can be marked ready, `validateWorkspace` applies the schema
in an in-memory SQLite database, checks that every table referenced in `db.js`
exists, requires parameterized SQL, verifies the script order and rejects
`localStorage` in `app.js`. The Tauri shell itself stays generic: it applies
whatever schema is embedded at build time.

The shell creates the database before the page loads. The frontend never runs
`CREATE TABLE` at runtime on desktop; the browser preview uses the
localStorage fallback instead.

A future `web` target keeps the previous behaviour (static app, localStorage
only) for apps that are not meant to be exported.

Builds share a warm Cargo cache at
`workspaces/.build-cache/cargo-target` (override with
`FAYA_TAURI_TARGET_DIR`). The template and the generated frontend change
between exports, but the dependency tree does not.

`enqueueBuild` spawns a local process per job. In production this single call is
replaced by a queue publish; the worker and the `BuildRunner` contract stay the
same.

## Why builds do not run in the web app

A desktop build compiles Rust and links WebView2, which takes minutes and
hundreds of megabytes of disk. The platform runs on Linux containers that scale
horizontally; they must not carry a Windows toolchain. Builds therefore run on
dedicated Windows workers:

```
API / web (Linux, autoscaled)
        │  enqueue build job (BullMQ / SQS)
        ▼
Windows build workers (pool, isolated)
        │  copy template + generated frontend
        │  cargo build --release
        ▼
S3-compatible object storage
        │  signed URL
        ▼
User downloads the .exe / installer
```

## BuildRunner contract

`src/engine/build/types.ts` defines the interface:

```ts
buildTauriApp(input: {
  workspaceDir: string;
  appName: string;
  identifier: string;
  timeoutMs?: number;
}): Promise<TauriBuildResult>
```

- `LocalTauriRunner` builds on the current machine. It is used by
  `tauri:proof` and for local development only.
- A production runner (`RemoteTauriRunner` or `QueueTauriRunner`) will send the
  same input to a worker and poll or subscribe for the result. The API route
  that exports an app only depends on `BuildRunner`, never on Cargo details.
- `getBuildRunner()` selects the implementation from `FAYA_BUILD_RUNNER`
  (default `local`, production `remote`).

## Worker requirements

- Windows Server 2022 or Windows 11, Rust stable, WebView2 runtime, NSIS.
- A warm cargo registry and `CARGO_TARGET_DIR` shared between builds on the
  same worker to keep incremental builds fast (`FAYA_TAURI_TARGET_DIR`).
- Disposable working directories. Generated frontend code is untrusted: no
  platform database, no API keys, no long-lived credentials on the worker.
- Resource limits (CPU, memory, disk, wall clock) and a hard timeout.
- No inbound network exposure. Workers pull jobs and push artifacts.
- One build per app version, with the template commit SHA stored alongside the
  artifact for reproducibility.

## Isolation

The generated desktop app has no shell, filesystem, network, or process
permissions. Only the `db_*` commands are exposed, and each app has its own
SQLite file in the OS application-data directory. This is the same default-deny
model as the generation workspace.

## Artifact lifecycle

1. Build produces `<app>.exe` (and optionally an NSIS installer with
   `--bundle nsis`).
2. The worker computes a SHA-256 checksum and uploads the artifact.
3. The database stores the artifact key, size, checksum, template version, and
   build log location.
4. The app detail screen serves a short-lived signed download URL.
5. Old artifacts are removed by lifecycle policy; metadata is retained.

## Scaling notes

- Builds are CPU-bound and bursty: autoscale workers on queue depth, not on
  request rate.
- Cache the Rust dependency compilation per template version; only the app
  crate and frontend change between generated apps.
- Prefer one build per (project, template version, app version) and deduplicate
  requests while a build is running.
- Signing certificates belong in a KMS/HSM or a dedicated signing service, never
  in worker environment variables in plaintext.
