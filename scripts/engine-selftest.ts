import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createWorkspace,
  listWorkspaceFiles,
  resolveInsideWorkspace,
  writeWorkspaceFile,
} from "../src/engine/workspace";
import { validateWorkspace } from "../src/engine/tools";

const VALID_HTML = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Test Faya-Studio</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <h1 id="title">Test</h1>
    <script src="app.js"></script>
  </body>
</html>`;

const VALID_CSS = `body { font-family: system-ui, sans-serif; }`;

const VALID_JS = `document.querySelector("#title").textContent = "OK";`;

async function main() {
  const workspace = await createWorkspace();
  let failures = 0;

  const check = (label: string, condition: boolean) => {
    console.log(`${condition ? "OK " : "FAIL"} ${label}`);
    if (!condition) failures += 1;
  };

  try {
    await writeWorkspaceFile(workspace.dir, "index.html", VALID_HTML);
    await writeWorkspaceFile(workspace.dir, "styles.css", VALID_CSS);
    await writeWorkspaceFile(workspace.dir, "app.js", VALID_JS);

    const files = await listWorkspaceFiles(workspace.dir);
    check(
      "les fichiers générés sont listés",
      files.some((file) => file.path === "index.html"),
    );

    const valid = await validateWorkspace(workspace.dir);
    check("une application valide passe les contrôles", valid.ok);
    if (!valid.ok) console.log(valid.report);

    let escaped = false;
    try {
      resolveInsideWorkspace(workspace.dir, "../outside.txt");
    } catch {
      escaped = true;
    }
    check("une tentative de sortie du workspace est refusée", escaped);

    await writeFile(
      path.join(workspace.dir, "bad.js"),
      "const = ;",
      "utf8",
    );
    const invalid = await validateWorkspace(workspace.dir);
    check(
      "une erreur JavaScript est détectée",
      !invalid.ok && invalid.report.includes("JS syntax error"),
    );

    await writeFile(
      path.join(workspace.dir, "broken.html"),
      "<html><body><script src=\"missing.js\"></script></body></html>",
      "utf8",
    );
    await writeFile(
      path.join(workspace.dir, "index.html"),
      '<!DOCTYPE html><html><head><title>Broken</title><script src="missing.js"></script></head><body></body></html>',
      "utf8",
    );
    const missingAsset = await validateWorkspace(workspace.dir);
    check(
      "un asset local manquant est détecté",
      !missingAsset.ok &&
        missingAsset.report.includes("Missing local asset"),
    );

    console.log(
      `\n${failures === 0 ? "Selftest réussi." : `${failures} échec(s).`}`,
    );
    if (failures > 0) process.exitCode = 1;
  } finally {
    await rm(workspace.dir, { recursive: true, force: true });
    console.log(`Workspace de test supprimé : ${workspace.dir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
