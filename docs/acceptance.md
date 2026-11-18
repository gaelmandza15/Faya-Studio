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
pas les IDs générés.

Limites : 5 flux et 25 étapes par flux.

## Exécution

```bash
npm run acceptance -- <workspace-id>
npm run acceptance -- e2e/fixtures/runner-app
```

Le runner :

1. sert le workspace sur un serveur HTTP local éphémère ;
2. lance Chromium headless ;
3. exécute chaque flux dans une page neuve ;
4. écrit `.faya/acceptance-results.json` ;
5. sort en erreur si un flux échoue.

Les applications desktop utilisent leur repli localStorage dans ce mode : le
plan valide l'interface, pas le pont SQLite. Le pont et la persistance restent
couverts par les tests E2E de la plateforme.

## Génération

Le prompt impose `acceptance.json` lors d'une génération. Le validateur refuse
une génération sans plan valide, ce qui déclenche la boucle de réparation.

Après une génération ou une modification réussie, le worker lance le runner
d'acceptation et journalise le résultat. Désactiver avec :

```env
FAYA_RUN_ACCEPTANCE=0
```

Le résultat n'échoue pas le job pour l'instant : c'est un rapport de qualité.
L'objectif suivant est d'en faire un statut visible dans la fiche application.

## Limites

- Le runner ne teste pas les appels réseau externes.
- Les noms d'accessibilité doivent être stables ; un libellé changé casse le
  plan.
- Les données de test ne sont pas isolées entre flux dans la version statique.
- Playwright doit être installé sur la machine du worker pour exécuter le plan.
