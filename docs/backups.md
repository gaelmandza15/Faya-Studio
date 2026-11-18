# Sauvegardes et restauration

## Portée

Une sauvegarde capture la **base SQLite côté plateforme** d'un projet :

- schéma et données de l'application ;
- état au moment du snapshot (`VACUUM INTO`, donc cohérent même avec WAL).

Ne sont **pas** inclus :

- la base SQLite locale des applications desktop ;
- les appareils synchronisés et le journal `SyncRecord` ;
- les fichiers du workspace hors base (`design.md`, `desktop-schema.sql`).

Conséquence : pour une application synchronisée, restaurer la base web ne
rembobine pas les postes desktop. La restauration est donc **bloquée tant que
la synchronisation desktop est active**.

## Utilisation

Depuis la fiche application, carte **Sauvegardes** :

- créer une sauvegarde manuelle ;
- télécharger le fichier `.db` ;
- restaurer une sauvegarde (projet non synchronisé) ;
- supprimer une sauvegarde.

Les 20 sauvegardes les plus récentes sont conservées. Chaque restauration crée
d'abord une sauvegarde de sécurité `pre-restore`, pour pouvoir revenir en
arrière.

## Sécurité et permissions

- Création, restauration, suppression et téléchargement exigent
  `project.update` (owner, admin, editor).
- Les fichiers sont stockés dans
  `workspaces/<projectId>/.faya/backups/`.
- Le téléchargement vérifie la session, l'appartenance à l'organisation et le
  rôle, puis sert le fichier avec `Content-Disposition: attachment`.
- Les noms de fichiers sont générés (`UUID.db`) et revalidés avant lecture.

## Restauration

`restoreProjectBackup` :

1. vérifie la sauvegarde et le fichier ;
2. crée une sauvegarde `pre-restore` ;
3. ferme la connexion SQLite mise en cache ;
4. remplace `app.db` (et supprime `-wal` / `-shm`) ;
5. rouvre la base et réapplique le schéma idempotent ;
6. diffuse un événement SSE `restore` pour recharger les onglets ouverts.

En cas de restauration sur une application synchronisée, l'action renvoie
`syncEnabled` et l'UI explique qu'il faut désactiver la synchronisation.

## API

```text
GET /api/projects/<projectId>/backups/<backupId>/download
```

## Limites actuelles

- Pas de sauvegarde des appareils desktop ni de l'historique de synchronisation.
- Pas d'export vers S3/R2 : les fichiers restent sur le volume de la plateforme.
- Pas de sauvegarde planifiée automatique.
- Restauration non coordonnée avec les clients desktop.

## Prochaines étapes

- stockage objet pour les sauvegardes ;
- sauvegardes planifiées et rétention configurable ;
- restauration coordonnée avec reset des appareils et du curseur de sync ;
- export/import de projet complet (workspace + base + versions).
