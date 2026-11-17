# Tests E2E Playwright

Le harnais Playwright vérifie la plateforme et une application générée
déterministe, sans connexion spéciale : Playwright pilote un vrai navigateur
vers `http://localhost:3000`, avec une session de test et un projet fixture.

```bash
npm run e2e           # suite complète
npm run e2e:headed    # navigateur visible
npm run e2e:report    # rapport HTML
```

## Architecture

```text
Playwright
  └─ storageState (.e2e/auth.json)
       └─ plateforme (localhost:3000)
            ├─ login → tableau de bord, applications
            ├─ /applications/<id> → bouton Lancer
            └─ /app/<id>
                 ├─ iframe fixture
                 ├─ Web Bridge → /api/projects/<id>/db
                 └─ SSE ← /api/projects/<id>/events
```

### Global setup

`e2e/global-setup.ts` prépare un environnement isolé :

- utilise le compte de démonstration `demo@faya-studio.app` ;
- crée ou met à jour le projet **E2E Runner**
  (`e2e00000-0000-4000-8000-000000000001`) dans son organisation ;
- copie `e2e/fixtures/runner-app` dans `workspaces/<id>` ;
- réinitialise la base SQLite de l'application (3 tâches) ;
- génère une clé d'application pour les tests de sync ;
- crée une session de test et écrit `.e2e/auth.json` (cookies
  `faya_session`, `faya_org`, `faya_locale=fr`) et `.e2e/state.json`.

Le teardown supprime le projet et la session. Le workspace reste sur disque :
le serveur de dev peut garder le fichier SQLite ouvert sur Windows.

### Fixture

`e2e/fixtures/runner-app` est une petite application volontairement réaliste :

- tâches SQLite : liste, ajout, bascule, suppression, compteurs ;
- tiroir latéral avec burger, `aria-expanded`, fermeture par Échap ;
- panneau de notifications avec badge non-lu qui disparaît à l'ouverture ;
- formulaire avec validation, état busy et toast ;
- responsive 360–1440 sans débordement ;
- pont Tauri détecté via `__TAURI_INTERNALS__` **et** `__TAURI__`.

Elle sert à la fois de cible E2E et de référence pour la checklist de finition
UI.

## Suites

| Fichier | Ce qui est vérifié |
| --- | --- |
| `platform.spec.ts` | tableau de bord, liste des applications, bouton Lancer, notifications, drawer mobile |
| `runner.spec.ts` | plein écran, pont SQLite, CRUD, persistance après reload, badge, drawer, responsive, erreurs console |
| `sync.spec.ts` | push desktop → événement SSE → rafraîchissement automatique de l'iframe |
| `mobile.spec.ts` | projet `mobile-chrome` (Pixel 7) : drawer tactile, runner plein écran, formulaire, absence de débordement |

Les tests de runner et de sync utilisent le vrai pont web, la vraie base
serveur et le vrai flux SSE. Aucun mock de l'API.

## Plateforme en ligne

Le harnais local crée la session et les données directement en base. Pour une
plateforme déployée (staging), utiliser le mode distant :

```bash
E2E_REMOTE=1 \
E2E_BASE_URL=https://staging.faya-studio.example \
E2E_PROJECT_ID=<id-du-projet-fixture> \
E2E_APP_KEY=fs_<clé> \
E2E_EMAIL=e2e@example.com \
E2E_PASSWORD=... \
npm run e2e
```

Dans ce mode :

- `global-setup.ts` ne touche pas à la base : il ouvre un navigateur, se
  connecte réellement via `/login`, puis sauvegarde `storageState` ;
- le projet fixture, son workspace et sa clé d'application doivent être
  provisionnés à l'avance dans l'environnement de staging ;
- `global-teardown.ts` ne supprime rien : le staging gère son propre cycle de
  vie ;
- `webServer` est désactivé : Playwright cible l'URL distante.

Recommandations staging :

- un tenant et un projet **E2E Runner** dédiés, jamais les données réelles ;
- un compte de test stable, avec un mot de passe en secret CI ;
- un seul instance de plateforme pendant les tests (rate limit et registre SSE
  sont en mémoire) ;
- HTTPS, cookies `secure`, et proxy autorisant les connexions SSE longues ;
- un reset périodique du tenant de test.

## Portable et mobile

Le projet Playwright `mobile-chrome` utilise un Pixel 7 (`hasTouch`) et vérifie :

- l'ouverture/fermeture du drawer au doigt ;
- le runner en hauteur dynamique (`100dvh`) sous la barre du navigateur ;
- l'absence de débordement horizontal ;
- l'ajout et la suppression d'une tâche au doigt.

Le runner utilise `h-dvh w-full` et non `h-screen w-screen` : sur un téléphone,
`100vh` inclut la barre d'URL mobile et peut couper le bas de l'application.
Le shell plateforme utilisait déjà `h-dvh`.

## Ajouter une application au harnais

Deux options :

1. **Fixture générique** : remplacer les fichiers de
   `e2e/fixtures/runner-app` par un autre jeu déterministe et adapter les
   libellés des tests.
2. **Application réelle** : dans `global-setup.ts`, créer un projet avec un
   `projectId` fixe et copier un workspace généré. C'est utile pour un test de
   non-régression sur une application métier précise.

Pour tester une application réelle sans fixture, il faut que son workspace
existe dans `workspaces/<id>` et que son `desktop-schema.sql` soit présent.

## CI

Le workflow prêt à l'emploi est dans
[`docs/ci/e2e-workflow.yml`](ci/e2e-workflow.yml). Pour l'activer, le copier en
`.github/workflows/e2e.yml` (via l'interface GitHub ou un token disposant du
scope `workflow`). Il exécute la suite sur `main` et les pull requests :

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npx playwright install --with-deps chromium
npm run e2e
```

Le rapport et les traces sont archivés en artefact.

## Limites

- **Fixture distante** : en mode `E2E_REMOTE=1`, le projet, son workspace et sa
  clé doivent être provisionnés à l'avance. Le setup ne peut pas les créer sans
  accès base ou endpoint de test dédié.
- **Base SQLite locale** : le harnais local suppose une seule instance de
  plateforme. Avec un stockage partagé, le setup devra créer les données via
  l'API.
- **Rate limit** : les tests restent sous 180 requêtes/minute. Une suite plus
  lourde devra prévoir un mode `FAYA_E2E=1` pour relever le plafond.
- **Same-origin** : Playwright accède à l'iframe car elle est same-origin. Si
  elle migre vers un domaine séparé, `frameLocator` continuera de fonctionner,
  mais les cookies et le pont devront être adaptés.
- **Pas de génération IA** : la suite ne teste pas la génération elle-même,
  seulement l'exécution et la persistance d'une application prête.

## Ce que Playwright ne remplace pas

La checklist `src/engine/ui-quality.ts` reste la référence pour les
vérifications sémantiques (compteurs cohérents, actions de ligne correctes,
états vides). Playwright automatise les parcours objectifs et reproductibles ;
il ne juge pas la pertinence métier d'un écran.
