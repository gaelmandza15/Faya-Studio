# Qualité UI des applications générées

Les applications générées fonctionnent souvent, mais échouent sur des détails
que l'utilisateur voit immédiatement : un badge de notifications qui ne
disparaît pas, un menu qui ne s'ouvre pas, un burger qui laisse la page
défiler derrière, un compteur qui ne suit pas la liste, un dialogue qui perd le
focus. Ces bugs ne cassent pas la génération : ils cassent la confiance.

Faya-Studio intègre donc une **passe de finition UI obligatoire**, exécutée par
l'agent avant `finish`, doublée d'un **audit statique** dans `run_checks`.

## Où c'est défini

| Élément | Rôle |
| --- | --- |
| `src/engine/ui-quality.ts` | Catalogue des vérifications + texte injecté dans le prompt système |
| `src/engine/ui-audit.ts` | Contrôles statiques objectifs sur HTML/CSS |
| `src/engine/frame.ts` | Ajoute la passe de finition au prompt de génération et de modification |
| `src/engine/tools.ts` | Ajoute les résultats de l'audit au rapport de `run_checks` |
| `scripts/ui-quality-audit.ts` | Audit d'un workspace existant en ligne de commande |

La checklist s'applique aux deux modes :

- **generate** : audit complet de l'application ;
- **modify** : audit des parcours touchés et des interactions adjacentes
  susceptibles de régresser (compteurs, badges, filtres, navigation, dialogues).

## Le catalogue

### Structure et navigation

- Le burger ouvre et ferme le même panneau ; icône et `aria-expanded` restent
  cohérents.
- Le drawer mobile se ferme au clic sur l'overlay, avec Échap et après le choix
  d'une destination.
- Le scroll de la page est verrouillé quand le drawer est ouvert, sans perte de
  position.
- Un seul élément de navigation est actif, et il correspond à la vue après
  rechargement et back/forward.
- La sidebar ne chevauche pas le contenu en desktop et reste masquée en mobile.
- Aucun scroll horizontal à 360 px.

### Menus, popovers et dropdowns

- Le déclencheur ouvre le panneau, un second clic le ferme (pas de double
  bascule).
- Clic extérieur et Échap ferment le panneau et rendent le focus au
  déclencheur.
- L'ouverture d'un menu ferme les autres.
- Le panneau n'est pas rogné par un ancêtre `overflow: hidden` ou un contexte
  d'empilement.
- `aria-expanded`, `aria-controls` et l'état visible sont toujours d'accord.
- Le clavier (flèches, Entrée) fonctionne et le choix ferme le menu quand c'est
  attendu.

### Notifications, badges et alertes

- Le badge est calculé à partir des éléments non lus, jamais codé en dur.
- L'ouverture du panneau marque les notifications comme lues (ou un « tout
  marquer comme lu » fonctionne) et le badge disparaît.
- À zéro non-lu, le badge est masqué, pas affiché « 0 ».
- Un état vide existe quand il n'y a aucune notification.
- L'état lu survit au rechargement et à la navigation.
- Fermer une notification décrémente le compteur une seule fois, sans valeur
  négative.
- Les compteurs du tableau de bord, de la sidebar et des badges se mettent à
  jour après lecture, fermeture, création ou suppression.
- Les toasts disparaissent seuls, peuvent être fermés, ne s'empilent pas
  indéfiniment et ne bloquent pas les clics.

### Modales et confirmations

- Ouverture/fermeture par le bouton, Échap et le comportement de backdrop
  prévu.
- Le focus entre dans le dialogue et revient au déclencheur à la fermeture.
- Le scroll d'arrière-plan est verrouillé sans saut de mise en page.
- Les actions destructives demandent confirmation ; annuler ne modifie rien.
- Un double clic sur « Enregistrer » ne crée pas de doublon.
- Le dialogue tient en 360×640 et 1440×900 ; le contenu long défile à
  l'intérieur.
- `role="dialog"`, `aria-modal` et un titre accessible sont présents.

### Formulaires et validation

- Chaque champ a un label visible ou un nom accessible.
- Les champs requis/invalides affichent un message ; aucun échec silencieux.
- Le bouton est désactivé ou en état « busy » pendant l'action ; double soumission
  impossible.
- Les erreurs disparaissent après correction ; le succès réinitialise le
  formulaire et ferme le panneau.
- Entrée soumet là où c'est attendu, Échap annule, le focus démarre sur le
  premier champ.
- Les valeurs saisies sont conservées après une erreur de validation.
- Les champs numériques, dates et montants gèrent 0 et les négatifs selon la
  règle métier.
- Les selects se remplissent depuis les données réelles et gèrent une liste
  vide.
- Tout bouton non-submit dans un formulaire a `type="button"`.

### Listes, tableaux et filtres

- Les états chargement / vide / erreur sont distincts ; pas de « 0 résultat »
  fugace pendant le chargement.
- La recherche est insensible à la casse (et aux accents si attendu) et se
  réinitialise correctement.
- Recherche, filtres et tri se combinent sans lignes ni compteurs périmés.
- Le nombre affiché correspond aux lignes visibles et se met à jour après
  mutation.
- « Effacer les filtres » restaure la liste complète.
- Les actions de ligne ciblent la bonne ligne après tri/filtrage.
- Pagination ou « charger plus » se réinitialise au changement de filtre et ne
  duplique pas les lignes.
- Les tableaux défilent horizontalement en mobile sans casser la page.
- Un en-tête sticky ne recouvre ni la première ligne ni la barre d'outils.

### CRUD et cohérence des données

- Création, modification et suppression rafraîchissent liste, compteurs, KPI et
  filtres actifs immédiatement.
- Supprimer une ligne filtrée conserve le filtre et affiche l'état vide si
  nécessaire.
- Favoris, épingles et statuts persistent et se réordonnent comme prévu.
- Les relations restent cohérentes après suppression (entreprise/contact,
  facture/lignes, etc.).
- La prévention des doublons fonctionne là où elle est requise.
- Les identifiants générés ne collisionnent pas après suppression ou création
  rapide.
- `updated_at` se met à jour à l'édition et le tri par date reste correct.
- Les données survivent à un rechargement complet, en desktop (SQLite) comme en
  navigateur.
- Les chemins desktop et navigateur renvoient les mêmes formes et valeurs.
- Une erreur SQL ou de stockage affiche un message lisible, pas un échec muet.

### Responsive

- L'application est utilisable en 360/390, 768, 1024 et 1440.
- Aucun débordement horizontal à ces largeurs.
- La sidebar devient un drawer en mobile ; le burger est le seul moyen de
  l'ouvrir.
- Les cibles tactiles font au moins ~40 px et ne sont pas recouvertes par une
  barre sticky.
- Modales et formulaires tiennent et défilent en 360×640.
- Tableaux et grilles s'adaptent au lieu d'être écrasés.
- Les actions d'en-tête ne chevauchent pas le titre en petit écran.

### Accessibilité

- Les parcours principaux se font entièrement au clavier.
- Le focus est toujours visible ; pas de `outline: none` sans replacement
  `:focus-visible`.
- Les boutons icône ont un `aria-label` ou un `title` équivalent.
- Les images ont un `alt` ; les images décoratives ont `alt=""`.
- `aria-expanded`, `aria-pressed` et `aria-current` reflètent l'état réel.
- Le contraste texte/icônes est suffisant.
- Les animations respectent `prefers-reduced-motion`.
- Dialogues et formulaires exposent un nom accessible.

### Cohérence visuelle

- L'espacement suit une échelle unique et les bords s'alignent.
- Un même composant a le même rendu partout.
- Les icônes ont la même taille et le même trait.
- Les couleurs viennent des tokens du design, pas de hex isolés.
- Rayons, bordures et ombres sont cohérents.
- Chargement, vide et erreur partagent le même langage visuel.
- La troncature ne coupe jamais un contrôle ni une valeur essentielle.
- Hover, focus, active et disabled existent et se distinguent.
- Aucun texte de remplissage (« Lorem ipsum », TODO, FIXME, « Bouton 1 »).
- Aucun contrôle mort : chaque bouton/lien fait quelque chose ou est
  visiblement désactivé avec une raison.

### État et cas limites

- Premier lancement avec base vide : états vides, pas de crash.
- Rechargement pendant/juste après une action : pas de données corrompues ni de
  spinner bloqué.
- Clics rapides répétés : pas de doublons ni de compteurs désynchronisés.
- Back/forward restaure la vue et les filtres attendus.
- Plusieurs onglets ne s'écrasent pas silencieusement ; le comportement de
  synchro/rafraîchissement est cohérent.
- Hors ligne ou requête en échec : chemin de reprise dans les applications
  synchronisées.
- Noms, notes et nombres très longs ne cassent pas la mise en page.
- Supprimer le dernier élément affiche l'état vide et des compteurs à zéro.
- Le tri avec valeurs égales est stable.
- Les frontières de dates (aujourd'hui, début/fin de mois, année bissextile)
  sont correctes.

### Acceptation finale

- Relire la demande initiale et confirmer chaque parcours demandé.
- Tracer chaque bouton principal jusqu'à son handler et à la mise à jour d'état.
- Pour chaque compteur/badge, vérifier qu'il dérive de la même source que la
  liste.
- Parcourir une fois chaque flux principal en surveillant la console.
- Confirmer l'absence de texte de remplissage, de contrôle inutilisé ou
  d'action « bientôt disponible ».
- Relancer `run_checks` après corrections.

## Audit statique

`run_checks` ajoute au rapport des lignes `UI QUALITY [...]`, et la commande
suivante audite n'importe quel workspace :

```bash
npm run ui:audit -- <workspace-id> [autre-id...]
npm run ui:audit -- workspaces/<id>
```

Contrôles objectifs actuels :

- identifiants `id` dupliqués ;
- références cassées (`aria-controls`, `aria-labelledby`, `aria-describedby`,
  `for`, `list`, `form`) ;
- boutons icône sans nom accessible ;
- `<button>` dans un `<form>` sans `type` ;
- `<img>` sans `alt` ;
- liens `href="#"` ;
- `onclick` vide ;
- textes de remplissage visibles ;
- `outline: none` sans `:focus-visible`.

Ces contrôles sont volontairement **haute précision** : ils ne remplacent pas
la passe interactive, ils attrapent les erreurs structurelles qui provoquent la
majorité des bugs de finition.

## Limites

- L'agent n'a pas de navigateur : il trace les handlers et l'état dans le code,
  il ne clique pas. La checklist lui impose de vérifier les chemins, pas de
  déclarer « testé » sans preuve.
- L'audit statique ne détecte pas un compteur qui ne se met pas à jour ou un
  menu qui ne se ferme pas : cela reste dans la checklist interactive.
- Les règles sont dans `src/engine/ui-quality.ts` ; `UI_QUALITY_VERSION` permet
  de tracer les évolutions.
- Une validation E2E Playwright couvre désormais une partie de ces parcours
  sur une application fixture déterministe (voir `docs/e2e.md`). Les
  vérifications métier spécifiques à chaque application restent dans le plan
  d'acceptation.
