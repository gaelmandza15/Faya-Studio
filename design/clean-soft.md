---
version: alpha
name: Clean Soft 
description: Design System épuré pour applications de bureau. Associe un canvas gris perle, des cartes blanches arrondies, des pilules d'action noir profond, un accent secondaire vif et des pastilles sémantiques pastel.
colors:
  bg:
    canvas: "#F5F6F8"
    topbar: "#FFFFFF"
    sidebar: "#F5F6F8"
    surface: "#FFFFFF"
    surfaceSubtle: "#F3F4F6"
    surfaceHover: "#EBEDF0"
  brand:
    primary: "#111827"
    primaryHover: "#1F2937"
    onPrimary: "#FFFFFF"
    # Accent secondaire (modifiable selon l'identité de l'application cible)
    accent: "#EC4899"
    accentHover: "#DB2777"
    accentGradient: "linear-gradient(135deg, #F43F8C 0%, #E8388B 100%)"
  text:
    primary: "#111827"
    secondary: "#6B7280"
    muted: "#9CA3AF"
    link: "{{ colors.brand.accent }}"
  border:
    subtle: "#EAECEF"
    default: "#E5E7EB"
    strong: "#D1D5DB"
  semantic:
    success: "#16C75B"
    successBg: "#DCFCE7"
    danger: "#EF4444"
    dangerBg: "#FEE2E2"
    info: "#3B82F6"
    infoBg: "#DBEAFE"
    warning: "#F59E0B"
    warningBg: "#FEF3C7"
    neutralAccent: "#8B5CF6"
    neutralAccentBg: "#EDE9FE"
typography:
  fontFamily:
    sans: "Plus Jakarta Sans, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
  scale:
    pageTitle:
      fontSize: 22px
      fontWeight: 700
      lineHeight: 1.25
      letterSpacing: "-0.015em"
    kpiValue:
      fontSize: 28px
      fontWeight: 700
      lineHeight: 1.15
    sectionTitle:
      fontSize: 16px
      fontWeight: 600
      lineHeight: 1.35
    cardTitle:
      fontSize: 15px
      fontWeight: 600
      lineHeight: 1.35
    body:
      fontSize: 14px
      fontWeight: 400
      lineHeight: 1.5
    label:
      fontSize: 13px
      fontWeight: 500
      lineHeight: 1.4
    caption:
      fontSize: 12px
      fontWeight: 400
      lineHeight: 1.4
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
layout:
  topbarHeight: 64px
  sidebarWidth: 228px
  contentPadding: "24px 32px"
rounded:
  sm: 8px
  md: 10px
  lg: 12px
  xl: 16px
  pill: 9999px
---

## Overview

Ce Design System définit une interface **« Clean Soft SaaS »** polyvalente, conçue pour les applications métier exigeant clarté, rapidité de lecture et faible fatigue visuelle :
- **Esthétique aérée** : un fond gris perle (`{{ colors.bg.canvas }}`) met naturellement en valeur des blocs blancs (`{{ colors.bg.surface }}`) généreusement espacés.
- **Ancrage monochrome à fort contraste** : les boutons d'action principaux et l'élément actif de navigation utilisent le noir profond (`{{ colors.brand.primary }}`) en forme de pilule (`rounded-full`).
- **Accentuation sélective** : une couleur d'accent vive (`{{ colors.brand.accent }}`, par défaut rose magenta, adaptable à la marque du projet) guide l'œil uniquement vers les liens secondaires (« Voir tout », « Gérer ») et les encarts d'alerte ou de mise en avant.
- **Code couleur pastel + vif** : les statuts, catégories et métriques utilisent des fonds pastel doux associés à des icônes ou points de couleur saturés.

---

## Colors

### Surfaces & Arrière-plans
- **`bg.topbar` (`#FFFFFF`)** : Barre supérieure pleine largeur, séparée du contenu par `1px solid {{ colors.border.subtle }}`.
- **`bg.canvas` & `bg.sidebar` (`#F5F6F8`)** : Arrière-plan neutre partagé entre la navigation latérale et l'espace de travail, séparés par une fine bordure verticale `1px solid {{ colors.border.subtle }}`.
- **`bg.surface` (`#FFFFFF`)** : Toutes les cartes (KPI, filtres, tableaux, grilles d'entités, modales).
- **`bg.surfaceSubtle` (`#F3F4F6`)** : Boutons secondaires légers (« Actualiser », « Annuler »), états inactifs de sélecteurs segmentés et survols doux.

### Couleurs d'action & de marque
- **`brand.primary` (`#111827`)** : Réservé aux CTA principaux (`+ Créer...`, `Enregistrer`) et à l'item actif du menu latéral. Texte toujours en `#FFFFFF`.
- **`brand.accent` (`#EC4899`)** : Réservé aux liens d'action contextuels (« Voir tout », « Modifier », « Réinitialiser ») et à la carte promotionnelle / d'onboarding en dégradé (`{{ colors.brand.accentGradient }}`). *(Note : ce token peut être remplacé par n'importe quelle couleur vive saturée pour adapter le thème à une autre marque tout en gardant le reste du système intact.)*

### Système sémantique universel
| Rôle sémantique | Couleur vive (point / icône / bouton actif) | Fond pastel (badge / conteneur d'icône) |
| :--- | :--- | :--- |
| **Success / Actif / Disponible** | `#16C75B` | `#DCFCE7` |
| **Danger / Urgent / Bloqué** | `#EF4444` | `#FEE2E2` |
| **Info / Principal / En cours** | `#3B82F6` | `#DBEAFE` |
| **Warning / En attente / Attention** | `#F59E0B` | `#FEF3C7` |
| **Archivé / Terminé / Secondaire** | `#8B5CF6` | `#EDE9FE` |

---

## Typography

Utiliser **Plus Jakarta Sans** (ou **Inter**). Activer l'antialiasing et `font-variant-numeric: tabular-nums` sur tous les compteurs, prix, dates et colonnes numériques.

- **Titre de page (`22px`, Bold 700)** : `#111827`, toujours suivi d'un sous-titre court en `13px` `#6B7280`.
- **Valeur KPI (`28px`, Bold 700)** : `#111827`.
- **Titre de panneau / section (`16px`, SemiBold 600)** : `#111827`.
- **Titre de carte d'entité (`15px`, SemiBold 600)** : `#111827`.
- **Corps de texte & Cellules (`14px`, Regular/Medium)** : `#111827`.
- **Labels de formulaires & En-têtes de tableau (`12px`–`13px`, Medium 500)** : `#6B7280` (casse standard, jamais tout en majuscules).

---

## Layout

Structure universelle **App Shell** (Topbar fixe + Sidebar fixe + Zone principale scrollable) :

1. **Topbar (`64px` de haut)** :
   - **Gauche** : Logo carré arrondi (`36px × 36px`, `rounded-sm`) + Nom de l'application (`16px` Bold) + descriptif court (`11px` `#6B7280`).
   - **Droite** : Utilitaires globaux minimalistes (paramètres, notifications, profil utilisateur) en icônes linéaires `#4B5563`.
2. **Sidebar (`228px` fixe, `padding: 16px`)** :
   - Liste verticale de liens principaux (`gap: 4px`, hauteur `42px` par item).
   - Pied de sidebar (ou sous le menu) : carte d'appel à l'action / onboarding (`{{ colors.brand.accentGradient }}`) optionnelle pour les messages clés (essai gratuit, configuration requise, mise à niveau).
3. **Zone de contenu (`padding: 24px 32px`, `gap: 20px` entre les sections)** :
   - **En-tête de vue** : Bloc titre/sous-titre à gauche ; bouton d'action principal (pilule noire) ou utilitaire (pilule grise claire) à droite.
   - **Bandeau KPI (4 colonnes égales, `grid-cols-4`, `gap: 16px`)** : En haut des pages de synthèse et de gestion.
   - **Corps de page modulaire** (combinable selon le besoin de l'écran) :
     - *Modèle Liste / Données* : Carte de recherche & filtres (`margin-bottom: 20px`) + Carte Tableau pleine largeur.
     - *Modèle Catalogue / Ressources* : Panneau blanc englobant une grille de cartes à **3 colonnes** (`grid-cols-3`, `gap: 16px`).
     - *Modèle Vue d'ensemble* : Panneaux empilés contenant des listes récentes, états vides ou rangées horizontales de mini-cartes de statut.
   - **Responsive** :
     - Tablette (`< 1024px`) : Grilles KPI et entités à 2 colonnes ; sidebar repliable en tiroir.
     - Mobile (`< 640px`) : Empilement à 1 colonne ; padding réduit à `16px`.

---

## Elevation & Depth

- **Panneaux & Cartes KPI (Niveau 1)** : Fond `#FFFFFF`, bordure quasi invisible `1px solid rgba(17, 24, 39, 0.04)` et ombre très diffuse `box-shadow: 0 2px 8px rgba(17, 24, 39, 0.04)`.
- **Cartes imbriquées & Champs de saisie (Niveau 2)** : Fond `#FFFFFF` sans ombre portée, délimités par une bordure nette `1px solid {{ colors.border.default }}` (`#E5E7EB`).
- **Pilules noires actives (CTA & Navigation)** : Légère ombre `0 2px 6px rgba(17, 24, 39, 0.14)` pour créer un relief subtil.
- **Modales / Tiroirs (Niveau 3)** : Fond `#FFFFFF`, `rounded-xl` (`16px`), ombre `0 16px 40px rgba(17, 24, 39, 0.12)` sur un backdrop léger `rgba(17, 24, 39, 0.35)`.

---

## Shapes

- **Panneaux principaux, Cartes KPI, Modales & Carte Highlight sidebar** : `border-radius: 16px` (`{{ rounded.xl }}`).
- **Cartes imbriquées (grilles d'entités, mini-cartes), Inputs & Selects** : `border-radius: 12px` (`{{ rounded.lg }}`).
- **Conteneurs d'icônes KPI (`40px × 40px`) & Boutons de sélecteurs segmentés** : `border-radius: 8px`–`10px` (`{{ rounded.sm }}` / `{{ rounded.md }}`).
- **Items actifs de navigation, Boutons CTA principaux/secondaires & Badges de statut** : `border-radius: 9999px` (`{{ rounded.pill }}`).

---

## Components

### 1. Boutons & Actions
- **Primaire** : Fond `#111827`, texte `#FFFFFF` `13px`–`14px` Medium/SemiBold, `rounded-full`, padding `10px 20px`. Hover : `#1F2937`.
- **Secondaire léger** : Fond `#F3F4F6`, texte `#111827`, `rounded-full`, padding `8px 16px`. Hover : `#EBEDF0`.
- **Bouton blanc inversé** (sur carte highlight colorée) : Fond `#FFFFFF`, texte `{{ colors.brand.accent }}` SemiBold, `rounded-full`.
- **Lien d'en-tête de bloc** : Texte `{{ colors.brand.accent }}`, `13px` SemiBold, aligné à droite du titre de section.

### 2. Cartes KPI (2 gabarits standards)
- **KPI Analytique (Synthèse)** :
  - Haut gauche : Label (`13px` `#6B7280`).
  - Bas gauche : Valeur (`28px` Bold `#111827`) + sous-indicateur (`12px` `#6B7280`).
  - Haut droite : Carré pastel (`40px × 40px`, `rounded-md`) contenant une icône linéaire (`18px`) de la couleur vive correspondante.
- **KPI Compteur de statut (Vue gestion)** :
  - Disposition horizontale centrée : carré pastel `40px × 40px` contenant un point plein (`10px`) à gauche ; valeur `26px` Bold + libellé `12px` `#6B7280` empilés à droite.

### 3. Carte d'Entité / Ressource (Grille 3 colonnes)
- Conteneur blanc `rounded-lg`, bordure `1px solid #E5E7EB`, padding `16px`.
- **Header** : Point de statut (`8px`) + titre `15px` SemiBold à gauche ; icône d'édition (`16px` `#6B7280`) à droite.
- **Corps** : 2 à 4 paires clé/valeur alignées (`justify-between`), clé en `#6B7280`, valeur en `#111827` SemiBold (`13px`).
- **Pied de carte (Sélecteur d'état rapide)** : Groupe de boutons égaux (`gap: 8px`, `height: 32px`, `rounded-sm`). L'état inactif est `#F3F4F6` texte `#374151` ; l'état actif prend la couleur sémantique pleine (`#16C75B`, `#EF4444`, `#F59E0B`, `#3B82F6`) avec texte `#FFFFFF`.

### 4. Barre de recherche & Tableau de données
- **Barre de filtres** : Carte blanche `rounded-xl` (`padding: 16px 20px`), champs avec label au-dessus (`13px` Medium `#374151`), hauteur d'input `42px`, `rounded-lg`, bordure `1px solid #E5E7EB`.
- **Tableau** : Largeur 100%, aucune bordure verticale, séparateur horizontal `1px solid #F3F4F6` entre les lignes, padding vertical de ligne `14px`–`16px`.
- **Badge de statut** : Pilule compacte (`padding: 4px 10px`, `rounded-full`, `12px` Medium) utilisant les paires pastel/vive définies dans les tokens.
- **Actions de ligne** : Icônes discrètes alignées à droite (`Eye`, `SquarePen`, `Trash2`), couleur `#4B5563` -> `#111827` au survol.

### 5. État vide (Empty State) & Mini-cartes de statut
- **Empty State** : Centré dans la carte blanche (`padding: 48px 24px`), icône linéaire `40px` en `#D1D5DB` + message explicatif `14px` en `#6B7280` (et bouton d'action optionnel si l'utilisateur peut créer le premier élément).
- **Mini-carte de statut** : Bordure `1px solid #E5E7EB`, `rounded-lg`, `padding: 12px 16px`, contenu centré sur 2 lignes (point coloré + identifiant en gras ; sous-label gris dessous).

---

## Do's and Don'ts

### Do's
- **Adapter uniquement le token `brand.accent` et le logo** pour personnaliser ce thème à une nouvelle marque, tout en conservant le noir `#111827` pour les actions principales et le gris `#F5F6F8` pour le fond.
- **Maintenir une hiérarchie stricte entre conteneur et sous-carte** : ombre légère sans bordure visible pour les panneaux externes ; bordure `1px solid #E5E7EB` sans ombre pour les cartes imbriquées.
- **Conserver des libellés courts et aérés** : pas plus de 3 à 4 métadonnées par carte d'entité et des titres sur une seule ligne.
- **Utiliser des icônes homogènes** (ex. Lucide Icons, `stroke-width: 1.75`) dans toute l'application.

### Don'ts
- **Ne pas inverser le contraste des tableaux** : pas d'en-têtes de tableau gris foncé ou noirs, ni de lignes zébrées (zebra striping) ; garder un fond blanc pur avec des séparateurs `#F3F4F6`.
- **Ne pas utiliser de bordures épaisses (> 1px)** ni d'ombres noires marquées sur les cartes standard.
- **Ne pas multiplier les couleurs vives dans une même carte** : une carte KPI ou une carte d'entité ne met en avant qu'une seule couleur sémantique à la fois.
- **Ne pas mélanger des rayons d'arrondis incompatibles** : les boutons principaux et items actifs restent en pilule (`9999px`), tandis que les cartes et champs restent en arrondi doux (`12px`–`16px`).