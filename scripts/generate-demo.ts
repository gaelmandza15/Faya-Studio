import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { createWorkspace } from "../src/engine/workspace";
import { generateApp } from "../src/engine/pi-engine";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const DEFAULT_PROMPT =
  "Crée une application de gestion de clients pour un petit commerce. " +
  "Elle doit permettre d'ajouter, rechercher et supprimer des clients, " +
  "afficher leur nom, e-mail et téléphone, et conserver les données dans le navigateur. " +
  "Utilise une interface moderne, sombre et responsive, avec une table, un formulaire " +
  "et un retour visuel clair. L'application doit tenir dans une seule page.";

async function main() {
  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    console.error(
      "\nDEEPSEEK_API_KEY manquant.\n" +
        "Ajoutez votre clé dans web/.env.local :\n\n" +
        "  DEEPSEEK_API_KEY=votre_cle\n\n" +
        "Ne committez jamais ce fichier.\n",
    );
    process.exitCode = 1;
    return;
  }

  const prompt = getArg("--prompt")?.trim() || DEFAULT_PROMPT;
  const workspace = await createWorkspace();

  console.log(`\nWorkspace : ${workspace.dir}`);
  console.log(`Prompt    : ${prompt}\n`);
  console.log("--- Agent Pi / DeepSeek ---\n");

  const result = await generateApp({
    prompt,
    workspaceDir: workspace.dir,
    onEvent(event) {
      if (event.type === "text") {
        process.stdout.write(event.text);
        return;
      }

      if (event.type === "status") {
        console.log(`\n[${event.status}]${event.message ? ` ${event.message}` : ""}`);
        return;
      }

      if (event.type === "tool_start") {
        const args =
          event.args && typeof event.args === "object"
            ? JSON.stringify(event.args).slice(0, 180)
            : "";
        console.log(`\n[tool] ${event.tool} ${args}`);
        return;
      }

      if (event.type === "tool_end") {
        console.log(
          `[tool] ${event.tool} ${event.isError ? "ERROR" : "OK"}${
            event.summary ? ` — ${event.summary.slice(0, 120)}` : ""
          }`,
        );
        return;
      }

      if (event.type === "error") {
        console.error(`\n[error] ${event.message}`);
      }
    },
  });

  console.log("\n\n--- Résultat ---\n");
  console.log(`Statut : ${result.ok ? "OK" : "ÉCHEC"}`);
  if (result.error) console.log(`Erreur : ${result.error}`);
  console.log(`Fichiers : ${result.files.map((file) => file.path).join(", ") || "(aucun)"}`);
  console.log(`\n${result.checkReport}\n`);

  if (result.summary) {
    console.log(`Résumé de l'agent :\n${result.summary}\n`);
  }

  console.log(
    `Aperçu : http://localhost:3000/api/workspaces/${workspace.id}/index.html`,
  );

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
