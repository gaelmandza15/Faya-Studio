# Faya-Studio — Plateforme full-stack

Application **Faya-Studio**, construite à partir de la maquette
(`../maquette.html`), du document de conception (`../Projet.txt`) et des notes
techniques (`../Technique.txt`).

La plateforme est bilingue français/anglais, dispose d'une authentification
réelle, génère des applications métiers avec Pi/DeepSeek et stocke les
utilisateurs, organisations, projets, crédits et builds dans une base SQLite via
Prisma. Les applications générées peuvent être exportées en exécutable Windows
Tauri 2 avec une base SQLite locale.

## Démarrage

```bash
npm install
npm run prisma:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Créer un fichier `.env` à partir de `.env.example` :

```env
DATABASE_URL="file:./dev.db"
```

Ouvrir [http://localhost:3000](http://localhost:3000).

**Compte de démonstration :**

```text
demo@faya-studio.app / demo1234
```

## Authentification et espace de travail

- Inscription, connexion et déconnexion par e-mail + mot de passe.
- Mots de passe hachés avec bcrypt, sessions opaques stockées en base et
  cookie HTTP-only (`faya_session`).
- Les pages de l'application sont protégées : un visiteur non connecté est
  redirigé vers `/login`.
- Chaque utilisateur possède une organisation et un solde de crédits.
- L'inscription crée automatiquement un espace personnel et 250 crédits.
- La langue choisie est enregistrée sur le compte (`User.locale`) et
  restaurée à la connexion.
- Le changement d'organisation active est prêt dans la barre supérieure
  (cookie `faya_org`), même si les comptes de démonstration n'ont qu'une
  organisation.

## Routes

| Route | Contenu |
| --- | --- |
| `/login` | Connexion |
| `/register` | Création de compte |
| `/` | Tableau de bord (projets réels de l'organisation) |
| `/creer` | Éditeur de création et aperçu |
| `/projets` | Liste réelle des projets, recherche, création, renommage, duplication, suppression |
| `/applications` | Liste réelle des applications |
| `/applications/[id]` | Fiche application (statut, description, dates, sections à venir) |
| `/credits` | Solde réel, consommation du mois et historique des transactions |
| `/parametres` | Profil, organisation, membres et langue |
| `/modeles` | Page d'attente « Modèles d'applications » |
| `/aide` | Page d'attente « Aide & support » |

L'éditeur accepte `?project=<id>` pour ouvrir un projet existant, ou
`?prompt=<demande>&name=<nom>` pour un aperçu non persisté.

## Base de données

SQLite + Prisma (`prisma/schema.prisma`). Le modèle couvre :

- `User`, `Organization`, `Membership` ;
- `Session` (sessions de connexion) ;
- `Project` (nom, prompt, icône, statut, organisation, dernière activité) ;
- `GenerationJob` (statut des générations Pi/DeepSeek) ;
- `BuildJob` (statut des exports Tauri, artefacts et durées de build) ;
- `CreditTransaction` (historique des crédits).

Commandes utiles :

```bash
npm run db:migrate      # appliquer le schéma
npm run db:seed         # compte et projets de démonstration
npm run db:studio       # explorer la base
npm run prisma:generate # régénérer le client Prisma
```

SQLite est utilisé pour le développement local. La cible de production reste
PostgreSQL ; le schéma et la couche d'accès sont isolés pour préparer la
migration.

## Moteur IA (développement)

Le cœur de génération repose sur **Pi** (`@earendil-works/pi-coding-agent`) et
**DeepSeek** (`deepseek-flash`).

Prérequis : ajouter `DEEPSEEK_API_KEY` dans `.env.local` (fichier ignoré par
git). `DEEPSEEK_MODEL` permet de choisir le modèle.

```bash
npm run engine:selftest   # vérifie le workspace confiné et le validateur
npm run engine:demo       # génère une application de démonstration
npm run engine:demo -- --prompt "Crée une application de ..."
```

Le moteur :

- crée un workspace isolé dans `workspaces/<id>` (ignoré par git) ;
- n'expose à l'agent que des outils de fichiers confinés, sans shell ;
- valide la structure HTML, les assets locaux et la syntaxe JavaScript ;
- écrit `index.html`, `styles.css`, `app.js` et peut être prévisualisé via
  `/api/workspaces/<id>/index.html`.

Le premier test réel a généré **GestiClient**, une application de gestion de
clients avec ajout, recherche, suppression et persistance locale.

## Génération dans l'éditeur

Chaque projet créé depuis l'interface déclenche une génération réelle :

- `startProjectAction` crée le projet, un `GenerationJob` et lance un worker
  Node détaché (`scripts/generation-worker.ts`).
- Le worker exécute Pi/DeepSeek, écrit les événements dans
  `workspaces/<projectId>/.faya/jobs/<jobId>.jsonl`, les logs dans
  `workspaces/.logs/<jobId>.log` et le résultat dans
  `.faya/results/<jobId>.json`.
- L'éditeur `/creer?project=<id>` interroge
  `/api/projects/<id>/generation?after=<curseur>&job=<jobId>` et affiche la
  conversation réelle, les outils utilisés, la progression et le résumé.
- Une fois prêt, l'application générée est chargée dans une iframe via
  `/api/workspaces/<projectId>/index.html`.
- Les projets existants sans aperçu (données de démonstration) proposent un
  bouton « Générer l'application ».

## Modification par conversation

Après une génération, l'utilisateur peut demander une modification directement
dans l'éditeur :

- `ProjectMessage` conserve les messages utilisateur et agent ;
- `sendProjectMessageAction` crée un `GenerationJob` de type `modify` avec
  l'instruction, puis lance le worker sans effacer le workspace ;
- le prompt de modification impose de lire l'application existante, de changer
  le minimum de fichiers et de préserver les fonctionnalités, les données et
  l'identité visuelle ;
- pour une application desktop, le schéma SQLite doit rester idempotent :
  `CREATE TABLE IF NOT EXISTS` est autorisé, `ALTER`/`DROP` sont interdits ;
- les événements et résultats sont stockés par job, ce qui permet de rejouer
  la conversation sans mélanger les générations ;
- un échec peut être relancé avec la même instruction via
  `retryGenerationAction`.

Limites actuelles : le worker détaché utilise `tsx` en local ; une file de
tâches dédiée sera nécessaire en production. La synchronisation cloud et le
multi-utilisateur dans les apps desktop restent à concevoir.

## Profil de génération desktop

Chaque projet porte une cible (`Project.target`, `desktop` par défaut). Pour la
cible desktop, le moteur produit une application réellement adossée à SQLite :

- `desktop-schema.sql` : tables, contraintes, index et données de départ ;
- une couche de données au choix (par exemple `db.js`), qui appelle
  `db_select` / `db_execute` sous Tauri et gère un repli local pour l'aperçu
  navigateur ;
- `index.html` et les assets nécessaires.

La structure des fichiers est libre : le moteur doit seulement respecter le
contrat du runtime et le résultat attendu. Le prompt décrit le cadre et la
qualité attendue, sans imposer une méthode d'exécution.

Le cadre est défini une seule fois dans `src/engine/frame.ts`
(`FRAME_VERSION`) : le prompt et le validateur en dérivent tous les deux, ce
qui évite les contraintes contradictoires.

Le validateur du moteur applique le schéma dans une base SQLite en mémoire
(`node:sqlite`), vérifie qu'il reste idempotent, que les tables référencées
existent et que l'application utilise le bridge Tauri. Il refuse aussi les
assets externes. Le worker de build copie ensuite `desktop-schema.sql` dans le
template : le shell applique le schéma au démarrage et l'EXE est validé par
`--self-test`.

## Design system

Toutes les nouvelles applications suivent le contrat de design
[`design/clean-soft.md`](design/clean-soft.md). Il définit les tokens de
couleurs, la typographie, les espacements, la structure App Shell, les rayons,
les ombres et les composants.

- Le contrat complet est injecté dans le prompt de génération.
- Il est copié en `design.md` dans chaque workspace de projet.
- Le build exclut `design.md` des assets de l'application.
- Les projets existants sans `design.md` conservent leur identité visuelle ;
  le contrat s'applique aux nouvelles générations et aux nouvelles interfaces
  des projets qui en disposent.

D'autres variantes de design pourront être ajoutées dans `design/`, puis
exposées comme choix utilisateur. Pour l'instant, Clean Soft est l'unique
modèle.

## Export desktop (Tauri 2 + SQLite)

Le bouton **Exporter** de l'éditeur compile l'application générée dans le
template fixe `templates/tauri-v2-sqlite` :

- `exportProjectAction` crée un `BuildJob` et lance
  `scripts/build-worker.ts` ;
- le worker copie le template et le frontend généré, remplace
  `src-tauri/migrations/schema.sql` par le `desktop-schema.sql` du projet, puis
  appelle le `BuildRunner` (`src/engine/build`) ;
- l'EXE est copié dans `workspaces/.artifacts/<jobId>/`, vérifié par
  `--self-test`, puis proposé au téléchargement via
  `/api/builds/<id>/download` ;
- l'interface suit le build en direct et permet de le relancer.

```bash
npm run tauri:proof   # copie le template, compile et exécute le self-test SQLite
```

Le runner local sert au développement. En production, `FAYA_BUILD_RUNNER` et la
file de build doivent pointer vers des workers Windows isolés, comme décrit
dans [`docs/tauri-builds.md`](docs/tauri-builds.md).

## Interactions du prototype

- Les suggestions remplissent le prompt ; « + Plus d'exemples » en révèle
  d'autres.
- « Créer mon app » crée un projet en base et lance la génération réelle.
- Les modèles créent eux aussi un projet réel, avec un nom et une icône
  déduits du modèle.
- Sans projet en base (aperçu direct), l'éditeur utilise une simulation :
  8 étapes, messages progressifs, puis aperçu **StockFlow**.
- Ouvrir un projet existant affiche sa génération réelle, sa progression et son
  aperçu prêt.
- Bascule desktop/mobile, onglets Conversation/Aperçu sur mobile, menu
  latéral en tiroir.
- Menus organisations, crédits, notifications, profil ; déconnexion réelle.
- Interface bilingue FR/EN, préférence persistée par cookie et par compte.
- Gestion réelle des projets : création, recherche, renommage, duplication et
  suppression avec confirmation.
- Applications : liste et fiche détaillée avec statut et dates.
- Crédits : solde, consommation du mois et historique des transactions.
- Paramètres : modification du profil, du nom de l'organisation, liste des
  membres, langue et session.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui (Base UI) + lucide-react
- Prisma 6 + SQLite
- bcryptjs + zod
- Pi Coding Agent SDK + DeepSeek (`deepseek-flash`)
- TypeBox pour les outils du moteur
- Tauri 2 + Rust + `rusqlite` pour l'export desktop
- Inter via `next/font`, sonner pour les notifications
- Dictionnaires FR/EN : `src/i18n/dictionaries/fr.ts` et `en.ts`
- Données de démonstration : `src/lib/mock-data.ts`
- Simulation : `src/components/editor/creation-studio.tsx`

## Scripts

```bash
npm run dev              # serveur de développement
npm run build            # build de production
npm run start            # serveur de production
npm run lint             # ESLint
npx tsc --noEmit         # vérification TypeScript
npm run engine:selftest  # auto-test du moteur de génération
npm run tauri:proof      # preuve de build Tauri + SQLite
```

## Périmètre

La plateforme couvre l'authentification, les sessions, les organisations, les
projets, les applications, les crédits, les paramètres, la génération réelle par
IA et l'export desktop Windows. Restent à brancher : consommation de crédits,
paiements, e-mails transactionnels, synchronisation cloud, export APK, profil de
génération SQLite pour les apps exportées et marketplace réelle. Les pages
`/modeles` et `/aide` restent des pages d'attente.
