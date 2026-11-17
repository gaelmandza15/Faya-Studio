# Faya-Studio — Plateforme full-stack

Application **Faya-Studio**, construite à partir de la maquette
(`../maquette.html`), du document de conception (`../Projet.txt`) et des notes
techniques (`../Technique.txt`).

La plateforme est bilingue français/anglais, dispose d'une authentification
réelle, génère des applications métiers avec Pi/DeepSeek et stocke les
utilisateurs, organisations, projets, crédits et builds dans une base SQLite via
Prisma. Les applications générées peuvent être exportées en exécutable Windows
Tauri 2 avec une base SQLite locale.

La suite du développement (abstractions, staging cloud sans Docker, cycle de
vie des applications) est planifiée dans
[`docs/roadmap.md`](docs/roadmap.md).

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
| `/applications/[id]` | Fiche application : versions, exports, publication, crédits, lien plateforme, appareils et connexions |
| `/credits` | Solde réel, consommation du mois et historique des transactions |
| `/parametres` | Profil, organisation, membres et langue |
| `/modeles` | Page d'attente « Modèles d'applications » |
| `/aide` | Page d'attente « Aide & support » |

L'éditeur accepte `?project=<id>` pour ouvrir un projet existant, ou
`?prompt=<demande>&name=<nom>` pour un aperçu non persisté.

## Observabilité

- `GET /api/health` : sonde publique (app + base), réponse 200/503 avec
  `version`, `timestamp`, `db`, `requestId` et `Cache-Control: no-store`.
- Logs JSON structurés via `src/lib/logger.ts`, avec `requestId`, `projectId`,
  `jobId` et `userId`. Niveau réglable avec `LOG_LEVEL`
  (`debug|info|warn|error`).
- Les workers de génération et de build utilisent le même logger.
- `src/lib/env.ts` valide `DATABASE_URL`, les URLs et les niveaux au démarrage ;
  `next.config.ts` échoue tôt si la configuration est invalide.

## Base de données

SQLite + Prisma (`prisma/schema.prisma`). Le modèle couvre :

- `User`, `Organization`, `Membership` ;
- `Session` (sessions de connexion) ;
- `Project` (nom, prompt, icône, statut, organisation, dernière activité) ;
- `GenerationJob` (statut des générations Pi/DeepSeek) ;
- `BuildJob` (statut des exports Tauri, artefacts et durées de build) ;
- `SyncRecord` / `SyncDevice` (journal de synchronisation et appareils liés) ;
- `WebhookEndpoint` / `WebhookDelivery` (connexions externes signées) ;
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

## Rôles, équipe et invitations

Quatre rôles sont appliqués côté serveur :

| Rôle | Capacités |
| --- | --- |
| `owner` | Tout, y compris les membres et l'organisation |
| `admin` | Projets, générations, builds, publications, versions, membres et organisation |
| `editor` | Création et modification d'apps, générations, builds, publications, restaurations |
| `viewer` | Lecture seule |

La matrice est définie dans `src/lib/roles.ts` et vérifiée dans toutes les
actions sensibles. L'interface masque ou désactive les actions interdites.

Les invitations sont générées depuis **Paramètres → Membres** sous forme de
lien valable 7 jours. L'invité peut se connecter ou créer un compte, puis
rejoint l'organisation avec le rôle prévu. Le propriétaire peut changer les
rôles et retirer des membres ; le rôle `owner` n'est pas modifiable et le
dernier propriétaire ne peut pas être retiré. Les liens d'invitation sont
affichés dans l'interface et copiés manuellement (aucun e-mail transactionnel
n'est encore envoyé).

## Versions et rollback

- Chaque génération ou modification réussie crée une `ProjectVersion` avec un
  snapshot complet des fichiers du projet dans
  `workspaces/<projectId>/.faya/versions/v<n>`.
- Avant la première modification d'un projet existant, une version de référence
  (`baseline`) est créée automatiquement.
- Le bouton **Versions** de l'éditeur liste l'historique, affiche la version
  courante et permet de restaurer un état antérieur avec confirmation.
- Une restauration crée elle-même une nouvelle version (`restore`), ce qui
  conserve un historique linéaire et un point de retour.
- Si une génération ou une modification échoue, la dernière version valide est
  restaurée automatiquement et le projet reste exportable.
- Les snapshots et journaux internes (`.faya`) sont exclus des outils de
  l'agent, de l'aperçu HTTP et des assets du build.

## Crédits

Les actions facturables réservent leurs crédits avant de lancer le travail :

- génération : 50 crédits ;
- modification : 20 crédits ;
- export desktop : 30 crédits.

`chargeCredits` décrémente le solde et crée une transaction négative dans la
même transaction SQLite. Le job conserve l'identifiant de la transaction. Si le
worker échoue ou si le spawn échoue, `refundCredits` crédite le solde et crée
une transaction de remboursement liée par `refId`, ce qui empêche tout double
remboursement.

Le solde est vérifié avant le lancement et l'interface affiche le coût au point
d'action. La page Crédits présente les tarifs et l'historique des débits et
remboursements.

Limites actuelles : le worker détaché utilise `tsx` en local ; une file de
tâches dédiée sera nécessaire en production. La synchronisation cloud des apps
desktop existe (voir plus bas), mais la gestion multi-utilisateur et les
permissions à l'intérieur de l'application restent à concevoir.

## Publication web

Le bouton **Publier** de l'éditeur rend l'application accessible sans compte :

- l'utilisateur choisit un slug (`/p/<slug>`) ;
- les fichiers de la version courante sont copiés dans
  `workspaces/.publications/<slug>` ;
- un enregistrement `Publication` conserve le slug, la version publiée et les
  dates ;
- la route publique `/p/<slug>` sert le HTML, les assets et injecte un
  `<base>` pour que les chemins relatifs fonctionnent ;
- **Republier** met à jour le slug et publie la version courante ;
- **Dépublier** supprime l'enregistrement et les fichiers publics.

Les visiteurs n'ont pas besoin d'être connectés. Les données de l'application
publiée restent locales au navigateur de chaque visiteur, comme dans l'aperçu.

## Fiche application

La fiche `/applications/[id]` relie l'application à toute la plateforme :

- versions récentes avec la version courante ;
- exports desktop, leur statut, leur version, leur taille et leur durée ;
- téléchargement direct de chaque EXE réussi ;
- publication web et lien public ;
- crédits consommés par les générations, modifications et builds ;
- créateur, organisation, nombre de membres, cible et identifiant.

`BuildJob.versionNumber` enregistre la version de l'application au moment du
build, ce qui permet de relier un exécutable à une version précise du projet.

## Mode Exécution et Web Bridge

Une application prête s'ouvre directement dans le navigateur, sans passer par
le studio :

- route plein écran `/app/[id]`, protégée par session et appartenance à
  l'organisation ;
- bandeau discret : retour à la fiche, nom, statut, « Données partagées »,
  mode desktop, actualisation, plein écran, nouvel onglet, « Modifier avec
  l'IA » ;
- bouton **Lancer l'application** sur la fiche, la liste des applications, le
  tableau de bord et le menu contextuel des projets.

Les données ne sont plus dans le `localStorage` du navigateur. La plateforme
maintient une base SQLite par projet dans
`workspaces/<id>/.faya/app.db`, initialisée depuis `desktop-schema.sql` :

- `GET /api/workspaces/[id]/[...path]` sert l'application et injecte un pont
  qui définit `window.__TAURI__` **et** `window.__TAURI_INTERNALS__` ;
- `POST /api/projects/[id]/db` exécute `db_select` / `db_execute` pour les
  membres de l'organisation ;
- le code généré reste inchangé : il appelle `invoke("db_select", …)` comme
  sous Tauri ;
- un viewer peut lire, pas écrire ; les écritures exigent `project.update` ;
- le SQL est confiné : une seule instruction, pas de `ATTACH`, `PRAGMA`,
  DDL, `VACUUM` ni écriture déguisée via `db_select` ;
- la CSP de l'application limite `connect-src` à son propre endpoint de
  données ;
- l'endpoint est limité à **180 requêtes/minute par utilisateur** (HTTP 429 +
  `Retry-After`) ;
- un flux SSE `/api/projects/[id]/events` rafraîchit automatiquement l'iframe
  après un `push` desktop ou une écriture d'un autre onglet web (anti-rebond,
  pas de rechargement pour sa propre écriture).

Le schéma est resynchronisé quand `desktop-schema.sql` change : nouvelles
tables via `CREATE TABLE IF NOT EXISTS`, nouvelles colonnes via `ALTER TABLE
ADD COLUMN` lorsque la définition le permet.

### Réconciliation avec le desktop

Le pont web et le moteur de synchronisation partagent le même flux :

- une écriture web (`db_execute`) est comparée avant/après sur sa table, puis
  les lignes créées/modifiées/supprimées sont enregistrées dans `SyncRecord`
  avec `deviceId = "web"` ;
- un `push` desktop accepté est appliqué à la base SQLite web du projet ;
- un desktop qui tire les changements reçoit donc les saisies faites dans le
  navigateur, et inversement.

Limites actuelles : une seule instance de plateforme (SQLite local et
registre SSE/rate-limit en mémoire, pas de stockage partagé multi-serveurs),
applications générées qui utilisent d'autres API Tauri que `invoke` non prises
en charge, et isolation same-origin de l'iframe à renforcer pour une exposition
publique.

## Applications liées et synchronisation

Chaque application choisit explicitement son mode :

- **locale** : l'EXE contient ses données SQLite et ne contacte jamais la
  plateforme ;
- **synchronisée** : l'EXE continue de fonctionner hors ligne dans sa base
  SQLite locale, puis réplique ses changements avec la plateforme et les
  autres appareils dès que le réseau revient.

Le mode se règle sur la fiche application, dans **Lien avec la plateforme**.
L'activation génère une **clé d'application** (`fs_…`), embarquée dans les
exports suivants. La rotation de la clé déconnecte immédiatement tous les
appareils déjà exportés.

### Protocole

- `POST /api/sync/handshake` : authentifie l'application et enregistre
  l'appareil ;
- `POST /api/sync/push` : envoie les lignes créées, modifiées ou supprimées ;
- `POST /api/sync/pull` : récupère les changements depuis un curseur.

L'authentification utilise `Authorization: Bearer <clé d'application>`.
Chaque ligne est identifiée par la clé primaire de sa table ; la résolution de
conflit est **dernier écrivain gagnant**, avec renvoi de la version serveur en
cas de conflit. Les suppressions sont des tombstones.

Côté EXE, `templates/faya-runtime/faya-sync.js` :

- découvre les tables SQLite et leurs colonnes via `PRAGMA table_info` ;
- détecte les changements locaux avec une table miroir `_faya_sync_rows`,
  sans modifier le code de persistance de l'application générée ;
- applique les changements distants et met à jour le miroir ;
- fonctionne hors ligne et reprend au retour du réseau ;
- affiche une pastille discrète de statut et expose `window.FayaSync`
  (`syncNow`, `getStatus`, `onChange`, `emit`).

Variables utiles : `FAYA_PLATFORM_URL` (URL publique de la plateforme gravée
dans les exports) ; à défaut `NEXT_PUBLIC_APP_URL`, puis
`http://localhost:3000`.

### Vérification

```bash
npm run sync:verify -- fs_...        # deux appareils + conflits + tombstones
npm run sync:verify-runtime          # injection de la config au build
```

`sync:verify` utilise la vraie API et le vrai moteur embarqué, avec deux bases
SQLite temporaires. Il nécessite un serveur de développement actif et une clé
d'application valide.

### Limites connues

- Pas encore d'auto-update signé des EXE synchronisés ; la publication
  `/p/[slug]` reste une copie figée, distincte du mode Exécution connecté.
- Conflits résolus par ligne, pas par champ.
- Les tables sans clé primaire exploitable sont ignorées.
- L'application locale ne demande pas de compte ; les rôles de la plateforme
  protègent la fiche, la clé et les connexions, pas l'usage de l'EXE.
- La clé d'application est stockée en clair pour pouvoir être embarquée dans
  les builds : chiffrement au repos et limitation de débit restent à ajouter
  avant une exposition publique à grande échelle.

## Connexions externes

La fiche application propose des **webhooks universels signés** : ils couvrent
n8n, Make, Zapier, Slack ou une API interne sans intégrer chaque fournisseur.

- L'EXE appelle `POST /api/hooks/events` avec sa clé d'application via
  `FayaSync.emit("facture.validee", { id: 42 })`.
- La plateforme relaie l'événement à chaque endpoint activé.
- Chaque requête porte `X-Faya-Event`, `X-Faya-Delivery`,
  `X-Faya-Timestamp` et `X-Faya-Signature: sha256=<hmac>`.
- La signature HMAC-SHA256 couvre `timestamp.body` avec le secret de
  l'endpoint.
- Chaque livraison est journalisée (`WebhookDelivery`) avec le code HTTP et
  l'erreur éventuelle ; l'UI affiche le dernier statut.

Limite actuelle : 10 endpoints par application, envoi immédiat sans retry
automatique. Les webhooks entrants (outil externe → application) restent à
concevoir.

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

## Qualité UI et finitions

En plus du design system, chaque génération et modification se termine par une
**passe de finition UI** obligatoire. Le catalogue complet est dans
[`docs/ui-quality.md`](docs/ui-quality.md) et dans
`src/engine/ui-quality.ts`.

Il couvre les bugs subtils qui passent les tests fonctionnels mais agacent
immédiatement : badge de notifications qui ne se vide pas, drawer qui laisse la
page défiler, menu qui double-bascule, dialogue qui perd le focus, compteurs
désynchronisés de la liste, filtres qui gardent des lignes périmées, actions de
ligne qui visent la mauvaise ligne, débordements en 360 px, focus invisible,
textes de remplissage oubliés.

- La checklist est injectée dans le prompt système en mode `generate` et
  `modify`.
- `run_checks` ajoute un audit statique : IDs dupliqués, références ARIA
  cassées, boutons icône sans nom, `<button>` sans `type` dans un formulaire,
  images sans `alt`, `href="#"`, `onclick` vide, `outline: none` sans
  `:focus-visible`, textes de remplissage.
- Audit d'un workspace existant :

```bash
npm run ui:audit -- <workspace-id> [autre-id...]
```

La checklist interactive reste indispensable : l'audit statique ne peut pas
vérifier qu'un menu se ferme ou qu'un compteur se met à jour. Une validation
E2E Playwright des applications générées est la prochaine étape naturelle.

## Tests E2E Playwright

Le harnais Playwright vérifie la plateforme et une application fixture
déterministe, avec une vraie session, le vrai Web Bridge SQLite et le vrai flux
SSE.

```bash
npm run e2e           # suite complète
npm run e2e:headed    # navigateur visible
npm run e2e:report    # rapport HTML
```

La suite couvre :

- tableau de bord, liste des applications et bouton « Lancer » ;
- notifications et drawer mobile de la plateforme ;
- runner plein écran, pont `__TAURI_INTERNALS__`, CRUD, reload, compteurs ;
- badge de notifications et tiroir de l'application ;
- absence de débordement en 390 px ;
- push desktop → SSE → rafraîchissement automatique ;
- projet `mobile-chrome` (Pixel 7) : tactile, hauteur `100dvh`, formulaire.

Le setup crée un projet **E2E Runner** isolé, une session et une clé
d'application, puis nettoie le tout. Pour une plateforme déployée, le mode
`E2E_REMOTE=1` se connecte réellement via `/login` et cible
`E2E_BASE_URL`. Détails et limites : [`docs/e2e.md`](docs/e2e.md). Le workflow
GitHub Actions prêt à l'emploi est dans
[`docs/ci/e2e-workflow.yml`](docs/ci/e2e-workflow.yml) ; il suffit de le copier
dans `.github/workflows/e2e.yml` pour l'activer.

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
npm run ui:audit -- <id> # audit statique de finition UI d'un workspace
npm run sync:verify -- <clé>        # sync réelle entre deux appareils
npm run sync:verify-runtime         # injection du runtime de sync au build
npm run e2e              # tests Playwright de la plateforme et du runner
npm run tauri:proof      # preuve de build Tauri + SQLite
```

## Périmètre

La plateforme couvre l'authentification, les sessions, les organisations, les
projets, les applications, les crédits, les paramètres, les rôles et
invitations d'équipe, la génération réelle par IA, les modifications, les
versions, la consommation de crédits, l'export desktop Windows, la publication
web, l'exécution connectée dans le navigateur, la synchronisation des
applications desktop et les webhooks externes.
Restent à brancher : paiements, e-mails transactionnels, mises à jour
automatiques des EXE, webhooks entrants, export APK et marketplace réelle. Les
pages `/modeles` et `/aide` restent des pages d'attente.
