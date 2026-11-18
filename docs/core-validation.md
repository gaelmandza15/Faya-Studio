# Validation du cœur — parcours réel

Date : 18 novembre 2026.

Objectif : vérifier la chaîne de valeur réelle sur un projet neuf, avec le vrai
moteur IA, la vraie base, le vrai Web Bridge et une vraie modification.

## Parcours testé

Prompt :

> Crée une application de gestion de contacts : nom, e-mail, téléphone,
> entreprise, recherche, ajout, modification et suppression, avec un tableau de
> bord simple.

Résultat : projet **Contacts Core**.

1. Génération réelle par Pi/DeepSeek.
2. Version 1 créée, projet `ready`.
3. Ouverture dans `/app/<id>`.
4. Lecture des données via le Web Bridge SQLite : 15 contacts.
5. Création d'un contact via le formulaire, persistance après reload.
6. Export CSV des contacts filtrés, téléchargement réel.
7. Suppression du contact avec confirmation.
8. Modification par conversation :
   « Ajoute un bouton Exporter CSV… ».
9. Version 2 créée, `run_checks` passe, résumé de modification produit.

## Problèmes de cœur trouvés et corrigés

### 1. Timeout de génération trop court

Une génération complexe dépassait 10 minutes et était interrompue.
Correction :

- timeout par défaut porté à **25 min** pour une génération et **15 min** pour
  une modification ;
- variable `FAYA_ENGINE_TIMEOUT_MS` pour ajuster.

### 2. Arrêt avec fichiers référencés manquants

L'agent a terminé en laissant `index.html` référencer `js/views.js` et
`js/app.js` non écrits. Le worker échouait sans réparation.

Correction : boucle de réparation automatique dans `generateApp`. Si
`validateWorkspace` échoue, le rapport est renvoyé à l'agent avec consigne de
corriger et de relancer `run_checks`, jusqu'à deux tentatives.

### 3. SSE bloqué après quelques rechargements

Le plafond de 5 connexions SSE par utilisateur/projet n'était pas libéré de
façon fiable, provoquant des `429` et la perte du temps réel. Le plafond a été
retiré ; il reviendra sous forme de lease distribué en multi-instance.

### 4. Bug de formulaire détecté par l'audit

L'application générée lisait `form.elements.first_name` alors que le champ
s'appelait `name="first"`. La création échouait silencieusement.

Correction : l'audit statique vérifie désormais les références
`form.elements.*` et `getElementById(...)` contre les `name`/`id` présents dans
le HTML et les templates JS. Les références manquantes sont signalées.

## Ce qui reste imparfait dans l'application générée

Ces points relèvent de la qualité du modèle, pas de la plateforme :

- la fenêtre modale de création reste ouverte après un ajout réussi ;
- le bouton « Nouveau contact » de la carte latérale n'a pas de handler ;
- le formulaire a dû être corrigé manuellement pour que le test CRUD passe.

La checklist UI et l'audit statique les signalent en partie, mais une
**validation E2E générée par application** reste nécessaire pour les attraper
systématiquement.

## Conclusion

Le cœur fonctionne : décrire → générer → exécuter → lire/écrire → modifier →
conserver. Les deux corrections essentielles sont le **timeout** et la
**boucle de réparation**. La prochaine amélioration de cœur est un scénario
d'acceptation généré avec l'application, exécuté par Playwright après chaque
génération.
