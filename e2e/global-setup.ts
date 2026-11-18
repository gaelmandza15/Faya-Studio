import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { getWorkspacesRoot } from "../src/engine/workspace";
import { PROJECT_ID, BACKUP_PROJECT_ID } from "./state";

config({ path: ".env.local" });
config({ path: ".env" });

const PROJECT_NAME = "E2E Runner";
const STATE_DIR = path.resolve(".e2e");
const FIXTURE_DIR = path.resolve("e2e/fixtures/runner-app");

async function setupRemote() {
  const baseURL = process.env.E2E_BASE_URL;
  const projectId = process.env.E2E_PROJECT_ID;
  const appKey = process.env.E2E_APP_KEY;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!baseURL || !projectId || !appKey || !email || !password) {
    throw new Error(
      "Remote E2E requires E2E_BASE_URL, E2E_PROJECT_ID, E2E_APP_KEY, E2E_EMAIL and E2E_PASSWORD.",
    );
  }

  await mkdir(STATE_DIR, { recursive: true });

  const browser = await chromium.launch();

  try {
    const host = new URL(baseURL).hostname;
    const context = await browser.newContext({ baseURL, locale: "fr-FR" });

    await context.addCookies([
      {
        name: "faya_locale",
        value: "fr",
        domain: host,
        path: "/",
        httpOnly: false,
        secure: baseURL.startsWith("https"),
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 30_000,
    });

    await context.storageState({ path: path.join(STATE_DIR, "auth.json") });
    await writeFile(
      path.join(STATE_DIR, "state.json"),
      JSON.stringify(
        {
          projectId,
          backupProjectId:
            process.env.E2E_BACKUP_PROJECT_ID ?? projectId,
          appKey,
          token: "",
          organizationId: "",
        },
        null,
        2,
      ),
      "utf8",
    );

    console.log(
      `[e2e] Logged in against ${baseURL} for project ${projectId}.`,
    );
  } finally {
    await browser.close();
  }
}

async function prepareWorkspace(target: string) {
  await mkdir(target, { recursive: true });

  // Keep .faya: the running dev server may hold the SQLite file open on
  // Windows. The database is reset below instead of being deleted.
  for (const entry of await readdir(target)) {
    if (entry === ".faya") continue;
    await rm(path.join(target, entry), { recursive: true, force: true });
  }

  for (const entry of await readdir(FIXTURE_DIR)) {
    await cp(path.join(FIXTURE_DIR, entry), path.join(target, entry), {
      recursive: true,
      force: true,
    });
  }

  const fayaDir = path.join(target, ".faya");
  await mkdir(fayaDir, { recursive: true });
  await rm(path.join(fayaDir, "backups"), {
    recursive: true,
    force: true,
  });

  const schema = await readFile(
    path.join(FIXTURE_DIR, "desktop-schema.sql"),
    "utf8",
  );
  const getter = (
    process as unknown as { getBuiltinModule?: (id: string) => unknown }
  ).getBuiltinModule;
  const sqlite = getter?.call(process, "node:sqlite") as
    | {
        DatabaseSync: new (location: string) => {
          exec(sql: string): void;
          prepare(sql: string): { run(...params: unknown[]): unknown };
          close(): void;
        };
      }
    | undefined;

  if (!sqlite) {
    throw new Error("node:sqlite is required for the E2E fixture database.");
  }

  const database = new sqlite.DatabaseSync(path.join(fayaDir, "app.db"));

  try {
    database.exec(schema);
    database.exec("DELETE FROM tasks");
    const insert = database.prepare(
      "INSERT INTO tasks (id, title, done) VALUES (?, ?, ?)",
    );
    insert.run(1, "Préparer la livraison", 0);
    insert.run(2, "Relancer le client", 0);
    insert.run(3, "Archiver le dossier", 1);
  } finally {
    database.close();
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function warmLocalRoutes(baseURL: string, cookie: string) {
  const healthUrl = `${baseURL}/api/health`;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(healthUrl, { cache: "no-store" });
      if (response.ok) break;
    } catch {
      // Server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const urls = [
    `${baseURL}/`,
    `${baseURL}/applications`,
    `${baseURL}/applications/${PROJECT_ID}`,
    `${baseURL}/app/${PROJECT_ID}`,
    `${baseURL}/api/workspaces/${PROJECT_ID}/index.html`,
    `${baseURL}/api/workspaces/${PROJECT_ID}/styles.css`,
    `${baseURL}/api/workspaces/${PROJECT_ID}/app.js`,
    healthUrl,
  ];
  const started = Date.now();

  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          headers: { cookie },
          cache: "no-store",
        });
        await response.text();
      } catch {
        // Best-effort warmup only.
      }
    }),
  );

  console.log(
    `[e2e] Warmed ${urls.length} routes in ${Date.now() - started}ms.`,
  );
}

export default async function globalSetup() {
  if (process.env.E2E_REMOTE === "1") {
    await setupRemote();
    return;
  }

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email: "demo@faya-studio.app" },
      select: { id: true },
    });

    if (!user) {
      throw new Error(
        "E2E setup requires the demo user. Run `npm run db:seed` first.",
      );
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      throw new Error("E2E setup requires the demo organization.");
    }

    const appKey = `fs_${randomBytes(20).toString("hex")}`;

    await prisma.project.upsert({
      where: { id: PROJECT_ID },
      create: {
        id: PROJECT_ID,
        name: PROJECT_NAME,
        prompt: "Application déterministe utilisée par les tests Playwright.",
        icon: "cube",
        status: "ready",
        target: "desktop",
        organizationId: membership.organizationId,
        createdById: user.id,
        syncEnabled: true,
        syncSeq: 0,
        appKey,
        appKeyPrefix: appKey.slice(0, 12),
        appKeyCreatedAt: new Date(),
      },
      update: {
        name: PROJECT_NAME,
        prompt: "Application déterministe utilisée par les tests Playwright.",
        icon: "cube",
        status: "ready",
        target: "desktop",
        organizationId: membership.organizationId,
        createdById: user.id,
        syncEnabled: true,
        syncSeq: 0,
        lastSyncAt: null,
        appKey,
        appKeyPrefix: appKey.slice(0, 12),
        appKeyCreatedAt: new Date(),
      },
    });

    await prisma.syncRecord.deleteMany({ where: { projectId: PROJECT_ID } });
    await prisma.syncDevice.deleteMany({ where: { projectId: PROJECT_ID } });

    await prepareWorkspace(path.join(getWorkspacesRoot(), PROJECT_ID));

    await prisma.project.upsert({
      where: { id: BACKUP_PROJECT_ID },
      create: {
        id: BACKUP_PROJECT_ID,
        name: "E2E Backup",
        prompt: "Application déterministe pour les tests de sauvegarde.",
        icon: "cube",
        status: "ready",
        target: "desktop",
        organizationId: membership.organizationId,
        createdById: user.id,
        syncEnabled: false,
      },
      update: {
        name: "E2E Backup",
        prompt: "Application déterministe pour les tests de sauvegarde.",
        icon: "cube",
        status: "ready",
        target: "desktop",
        organizationId: membership.organizationId,
        createdById: user.id,
        syncEnabled: false,
        appKey: null,
        appKeyPrefix: null,
        appKeyCreatedAt: null,
        syncSeq: 0,
        lastSyncAt: null,
      },
    });

    await prisma.syncRecord.deleteMany({
      where: { projectId: BACKUP_PROJECT_ID },
    });
    await prisma.syncDevice.deleteMany({
      where: { projectId: BACKUP_PROJECT_ID },
    });

    await prepareWorkspace(
      path.join(getWorkspacesRoot(), BACKUP_PROJECT_ID),
    );

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt,
      },
    });

    await mkdir(STATE_DIR, { recursive: true });

    const expires = Math.floor(expiresAt.getTime() / 1000);

    await Promise.all([
      writeFile(
        path.join(STATE_DIR, "auth.json"),
        JSON.stringify(
          {
            cookies: [
              {
                name: "faya_session",
                value: token,
                domain: "localhost",
                path: "/",
                expires,
                httpOnly: true,
                secure: false,
                sameSite: "Lax",
              },
              {
                name: "faya_org",
                value: membership.organizationId,
                domain: "localhost",
                path: "/",
                expires,
                httpOnly: false,
                secure: false,
                sameSite: "Lax",
              },
              {
                name: "faya_locale",
                value: "fr",
                domain: "localhost",
                path: "/",
                expires,
                httpOnly: false,
                secure: false,
                sameSite: "Lax",
              },
            ],
            origins: [],
          },
          null,
          2,
        ),
        "utf8",
      ),
      writeFile(
        path.join(STATE_DIR, "state.json"),
        JSON.stringify(
          {
            projectId: PROJECT_ID,
            backupProjectId: BACKUP_PROJECT_ID,
            appKey,
            token,
            organizationId: membership.organizationId,
          },
          null,
          2,
        ),
        "utf8",
      ),
    ]);

    await warmLocalRoutes(
      process.env.E2E_BASE_URL ?? "http://localhost:3000",
      `faya_session=${token}; faya_org=${membership.organizationId}; faya_locale=fr`,
    );

    console.log(
      `[e2e] Seeded ${PROJECT_NAME} (${PROJECT_ID}) and a test session.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
