# Utilisateurs et permissions par application

Chaque application possède désormais son propre périmètre d'accès, indépendant
du rôle global dans l'organisation. Objectif : permettre de restreindre une
application sensible à quelques personnes, tout en gardant les administrateurs
de l'organisation maîtres de l'ensemble.

## Modèle

- `Project.accessMode` : `organization` (défaut) ou `restricted`.
- `ProjectMember` : `(projectId, userId)` unique, avec un rôle
  `viewer | editor | admin`.

## Modes

### `organization` (défaut)

Tous les membres de l'organisation voient l'application. Leur rôle
d'organisation est converti :

| Rôle organisation | Rôle application |
| --- | --- |
| owner / admin | admin |
| editor | editor |
| viewer | viewer |

C'est le comportement historique : aucune migration de données nécessaire.

### `restricted`

Seuls les membres listés dans `ProjectMember` ont accès. Les rôles
`owner` et `admin` de l'organisation conservent toujours un accès `admin`, même
sans ligne explicite. Un membre de l'organisation non listé n'a aucun accès :
`/app/<id>` renvoie 404 et les API renvoient 403.

## Rôles application

| Rôle | `view` | `write` | `manage` |
| --- | --- | --- | --- |
| viewer | oui | non | non |
| editor | oui | oui | non |
| admin | oui | oui | oui |

- `view` : ouvrir `/app/<id>`, charger le workspace, lire la base, recevoir le
  flux SSE.
- `write` : écrire dans la base de l'application, lancer une génération ou une
  modification, exporter un exe, publier, relancer l'acceptation.
- `manage` : gérer les utilisateurs de l'application, les sauvegardes, les clés
  de synchronisation, les webhooks et restaurer une version.

## Points d'application

Le helper `src/lib/project-access.ts` expose `getProjectAccess`,
`effectiveAppRole`, `appCan` et `projectVisibilityWhere`.

Les contrôles sont appliqués dans :

- pages `/app/<id>`, `/applications/<id>`, `/creer?project=<id>` ;
- routes `/api/workspaces/<id>`, `/api/projects/<id>/db`,
  `/api/projects/<id>/events`, `/api/projects/<id>/{generation,versions,builds,publication}` ;
- téléchargements de sauvegarde et d'exécutable ;
- server actions : génération, exports, sauvegardes, restauration de version,
  publication, synchronisation, webhooks, acceptation, renommage, duplication,
  suppression, relance.

Les listes (`/`, `/projets`, `/applications`) filtrent les applications
restreintes : un membre non listé ne les voit pas. Les cartes pointent vers
l'éditeur pour un rôle `write`, sinon vers la fiche application.

## Gestion dans l'interface

La carte **Utilisateurs de l'application** de la fiche application permet à un
rôle `manage` de :

- basculer entre « Toute l'organisation » et « Membres sélectionnés » ;
- ajouter un membre de l'organisation avec un rôle ;
- changer son rôle ;
- le retirer.

Un membre ne peut pas être ajouté s'il n'appartient pas à l'organisation de
l'application. Les administrateurs de l'organisation sont affichés en `admin`
et ne peuvent pas être retirés de ce droit.

## Ce qui reste hors périmètre

- Les appareils desktop liés par clé d'application ne sont pas concernés : la
  clé reste le secret d'accès de l'appareil.
- L'API d'ingestion externe garde son authentification par clé d'application.
- Les publications publiques (`/p/<slug>`) restent publiques par conception.
- Les crédits de génération restent soumis aux permissions de l'organisation.
