# Faya Tauri 2 + SQLite template

This template is the fixed, portable runtime used by Faya-Studio to turn a
generated business app into a desktop application. The frontend is plain
HTML/CSS/JS so it can be produced by the generation engine, and the Rust shell
exposes a small, generic SQLite API.

## Layout

```
src/                     Static frontend (frontendDist)
src-tauri/src/lib.rs     Tauri commands: db_execute, db_select
src-tauri/src/main.rs    Entry point + --self-test mode
src-tauri/migrations/    Initial schema (contacts demo)
src-tauri/tauri.conf.json
```

## SQLite API

The frontend calls the shell through `window.__TAURI__.core.invoke`:

```js
// Read
const rows = await invoke("db_select", {
  query: "SELECT * FROM contacts ORDER BY name",
  params: [],
});

// Write
await invoke("db_execute", {
  query: "INSERT INTO contacts (name, email) VALUES (?1, ?2)",
  params: ["Ada", "ada@example.com"],
});
```

Each installed app gets its own database in the OS application-data directory
(`%APPDATA%\<identifier>\faya_app.db` on Windows, `~/Library/...` on macOS,
`~/.local/share/...` on Linux). No data is shared between generated apps.

Only `core:default` is enabled in `src-tauri/capabilities/default.json`; the
frontend cannot read or write arbitrary files, spawn processes, or make network
requests.

## Local development

```bash
npm install
npm run tauri dev
```

## Build and verification

```bash
npm run tauri build -- --no-bundle
```

The release executable is written to
`src-tauri/target/release/tauri-v2-sqlite.exe`. It supports a headless
self-test that opens an in-memory database, applies the schema, and runs a
temporary write/read round-trip, then exits with `0`:

```bash
./src-tauri/target/release/tauri-v2-sqlite.exe --self-test
# TAURI_SQLITE_SELFTEST_OK tables=1
```

## How Faya-Studio uses it

`scripts/tauri-proof.ts` (root project) copies this template into a new
workspace, rebuilds it with a generated app name and identifier through the
`BuildRunner` abstraction (`src/engine/build`), then runs the self-test.

The local runner is a development and proof tool. Production builds must run on
dedicated Windows build workers, never on the web/API machines:

- keep a warm `CARGO_TARGET_DIR` / cargo registry cache to avoid recompiling the
  whole dependency tree for every app;
- treat generated code as untrusted: run builds in disposable workers without
  access to the platform's database or secrets;
- upload the resulting binary to object storage (S3-compatible) and serve it
  through a signed URL;
- keep the template versioned so a build remains reproducible.

See `docs/tauri-builds.md` for the production pipeline.
