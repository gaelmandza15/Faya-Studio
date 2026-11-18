# Plans d'acceptation générés

Chaque application générée doit maintenant livrer un fichier
`acceptance.json` à la racine de son workspace. Il décrit 2 à 4 parcours
critiques que Playwright peut exécuter sans connaître le métier.

## Format

```json
{
  "version": 1,
  "flows": [
    {
      "name": "Créer un contact",
      "steps": [
        { "action": "click", "locator": { "role": "button", "name": "Nouveau contact" } },
        { "action": "fill", "locator": { "label": "Prénom" }, "value": "Test" },
        { "action": "click", "locator": { "role": "button", "name": "Créer le contact" } },
        { "action": "expectHidden", "text": "Nouveau contact" },
        { "action": "expectText", "text": "Test" }
      ]
    }
  ]
}
```

### Actions

| Action | Champs |
| --- | --- |
| `click` | `locator`, `exact?` |
| `fill` | `locator`, `value` |
| `select` | `locator`, `value` |
| `press` | `key` |
| `expectText` | `text`, `exact?` |
| `expectHidden` | `text` |
| `reload` | — |
| `wait` | `ms` |

Un `locator` accepte `role` + `name`, `label`, `placeholder`, `text` ou
`selector`. Les plans doivent privilégier les rôles et libellés accessibles,
pas les IDs générés. Un locator doit désigner un seul élément.

Les flux doivent vérifier l'état final (une ligne, un compteur, un panneau qui
reste fermé), pas un toast éphémère. Le contrat de génération demande aussi de
couvrir la recherche, la modification, la suppression et la persistance après
`reload`.

Limites : 5 flux et 25 étapes par flux.

## Exécution

```bash
npm run acceptance -- <workspace-id>
npm run acceptance -- e2e/fixtures/runner-app

# Mode plateforme (Web Bridge + SQLite réels)
tsx scripts/run-acceptance.ts --project <id> \
  --base-url http://127.0.0.1:3000 --token <session> --org <organization-id> \
  --sandbox acceptance-manual --out .faya/acceptance/manual.json
```

Le runner :

1. en mode statique, sert le workspace sur un serveur HTTP local éphémère ;
   en mode plateforme, charge le document réel
   `/api/workspaces/<id>/index.html`, celui que l'iframe du runner embarque ;
2. lance Chromium headless ;
3. exécute chaque flux dans une page neuve ;
4. écrit un rapport JSON (`--out`, sinon `.faya/acceptance-results.json`) ;
5. sort en erreur si un flux échoue (code 1), si Chromium manque (4) ou si le
   plan est absent/invalide (3).

## Données isolées

En mode plateforme, la gate crée une base jetable
`.faya/sandbox/<sandbox>.db`, initialisée avec `desktop-schema.sql` (donc son
jeu de données de départ). Le pont envoie l'en-tête `X-Faya-Sandbox` et le
serveur route les requêtes vers cette copie. Conséquences :

- les flux ne touchent jamais les données réelles de l'application ;
- les écritures de test ne polluent pas le flux de synchronisation desktop ;
- chaque exécution utilise un sandbox neuf, donc les compteurs et les doublons
  ne s'accumulent pas ;
- les sandboxes de plus de 10 minutes sont nettoyées à l'ouverture du suivant.

## Porte de qualité

Lors d'une génération ou d'une modification :

1. la validation statique passe ;
2. le worker exécute `acceptance.json` dans le vrai runner ;
3. si un flux échoue, le rapport (flux, étape, erreur, erreurs console) est
   renvoyé à l'agent dans la même session ;
4. l'agent corrige l'application ou le plan, puis `run_checks` et une nouvelle
   exécution sont demandés ;
5. deux tentatives de réparation maximum.

Le job n'échoue pas si l'acceptation reste en échec : l'application est
conservée et le statut est visible dans la fiche. C'est un garde-fou de
qualité, pas un rollback.

Si la plateforme est injoignable (worker sur une autre machine, serveur arrêté
en local), la gate bascule en mode statique et le résultat est marqué comme
dégradé. Configurer l'URL avec :

```env
FAYA_ACCEPTANCE_URL=https://staging.exemple.com
# ou FAYA_PLATFORM_URL, sinon http://127.0.0.1:3000
```

Désactiver complètement :

```env
FAYA_RUN_ACCEPTANCE=0
```

## Statut dans la fiche application

La carte **Qualité de l'application** affiche :

- le statut (`Validée`, `Échec`, `Non exécutée`, `En attente`) ;
- le nombre de flux validés et la date du dernier contrôle ;
- les flux en échec avec l'étape et l'erreur ;
- les erreurs console ;
- un bouton **Relancer les tests** pour les membres autorisés à modifier
  l'application, désactivé pendant une génération.

Le résultat est stocké sur `Project` (`acceptanceStatus`, `acceptancePassed`,
`acceptanceTotal`, `acceptanceFailed`, `acceptanceRunAt`, `acceptanceError`,
`acceptanceReport`).

## Limites

- Le runner ne teste pas les appels réseau externes.
- Les noms d'accessibilité doivent être stables ; un libellé changé casse le
  plan.
- Playwright et Chromium doivent être installés sur la machine du worker.
- La gate ajoute jusqu'à quelques minutes par tentative de réparation.
