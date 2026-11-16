import type { Locale } from "@/i18n/config";
import type { DemoData } from "@/lib/types";

export const USER = {
  firstName: "Jean",
  lastName: "Dupont",
  initials: "JD",
  email: "jean.dupont@masociete.fr",
};

export const CREDITS = 2750;

const fr: DemoData = {
  companyName: "Ma Société",
  organizations: [
    { id: "ma-societe", name: "Ma Société", plan: "Plan Pro" },
    { id: "espace-perso", name: "Espace personnel", plan: "Plan Starter" },
  ],
  projects: [
    {
      id: "gestion-commerciale",
      name: "Gestion Commerciale",
      modified: "Modifié il y a 2 h",
      icon: "cube",
      prompt:
        "Reprends mon application Gestion Commerciale et ajoute un suivi des ventes du mois.",
    },
    {
      id: "planning-equipe",
      name: "Planning Équipe",
      modified: "Modifié il y a 1 jour",
      icon: "calendar",
      prompt:
        "Reprends mon application Planning Équipe et améliore la vue calendrier des tâches.",
    },
    {
      id: "suivi-budget",
      name: "Suivi Budget",
      modified: "Modifié il y a 2 jours",
      icon: "chart",
      prompt:
        "Reprends mon application Suivi Budget et ajoute un graphique des dépenses par catégorie.",
    },
    {
      id: "portail-clients",
      name: "Portail Clients",
      modified: "Modifié il y a 3 jours",
      icon: "users",
      prompt:
        "Reprends mon application Portail Clients et ajoute un espace de suivi des demandes.",
    },
  ],
  templates: [
    {
      id: "gestion-de-projet",
      name: "Gestion de projet",
      description: "Planifiez et suivez vos projets",
      icon: "project",
      prompt:
        "Crée une application de gestion de projet avec planification, tâches et suivi d'avancement.",
    },
    {
      id: "facturation",
      name: "Facturation",
      description: "Gérez vos devis et factures",
      icon: "invoice",
      prompt:
        "Crée une application de facturation avec gestion des devis, des clients et export PDF.",
    },
    {
      id: "crm",
      name: "CRM",
      description: "Suivez vos clients et prospects",
      icon: "crm",
      prompt:
        "Crée un CRM moderne pour suivre mes clients, prospects, opportunités et relances.",
    },
    {
      id: "tableau-de-bord",
      name: "Tableau de bord",
      description: "Visualisez vos données",
      icon: "dashboard",
      prompt:
        "Crée un tableau de bord pour visualiser mes données commerciales avec graphiques et filtres.",
    },
  ],
  features: [
    {
      title: "Création assistée par IA",
      description: "Une simple description, et c'est parti !",
      icon: "bolt",
      href: "/creer",
      accent: "amber",
    },
    {
      title: "Environnements isolés",
      description: "Vos projets en toute sécurité",
      icon: "shield",
      href: "/applications",
      accent: "brand",
    },
    {
      title: "Applications exportables",
      description: "Desktop, Web ou Mobile",
      icon: "rocket",
      href: "/modeles",
      accent: "brand",
    },
    {
      title: "Support réactif",
      description: "Nous sommes là pour vous",
      icon: "headset",
      href: "/aide",
      accent: "brand",
    },
  ],
  baseSuggestions: [
    {
      label: "Gestion de stock",
      prompt:
        "Crée une application de gestion de stock avec suivi des entrées/sorties et alertes de seuil.",
      icon: "stock",
    },
    {
      label: "Facturation",
      prompt:
        "Crée une application de facturation avec gestion des devis, clients et export PDF.",
      icon: "invoice",
    },
    {
      label: "CRM",
      prompt:
        "Crée un CRM moderne pour suivre mes prospects, opportunités et relances.",
      icon: "crm",
    },
    {
      label: "Planning",
      prompt:
        "Crée une application de planning d'équipe avec vue calendrier et attribution de tâches.",
      icon: "planning",
    },
  ],
  extraSuggestions: [
    {
      label: "Gestion de projet",
      prompt:
        "Crée une application de gestion de projet avec tâches, échéances et suivi d'avancement.",
      icon: "project",
    },
    {
      label: "Réservations",
      prompt:
        "Crée une application de réservation avec calendrier, disponibilités et confirmation par e-mail.",
      icon: "booking",
    },
    {
      label: "Suivi de production",
      prompt:
        "Crée une application de suivi de production avec ordres de fabrication et contrôle qualité.",
      icon: "production",
    },
    {
      label: "Gestion des dépenses",
      prompt:
        "Crée une application de gestion des dépenses avec justificatifs, catégories et export Excel.",
      icon: "expenses",
    },
  ],
  notifications: [
    {
      id: "notif-1",
      title: "Application mise à jour",
      description: "Gestion Commerciale a été mise à jour avec succès.",
      time: "Il y a 12 min",
      icon: "success",
      unread: true,
    },
    {
      id: "notif-2",
      title: "Crédits IA utilisés",
      description:
        "3 crédits ont été consommés lors de la dernière modification.",
      time: "Il y a 1 h",
      icon: "credits",
      unread: true,
    },
    {
      id: "notif-3",
      title: "Sauvegarde terminée",
      description: "La sauvegarde de vos projets est disponible.",
      time: "Hier",
      icon: "success",
      unread: false,
    },
  ],
  defaultPrompt:
    "Crée une application de gestion de stock avec recherche et export PDF.",
  generation: {
    steps: [
      {
        id: "analyse",
        label: "Analyse de la demande",
        message:
          "J'ai analysé votre demande. Je vais créer une application claire, adaptée à votre activité et utilisable immédiatement.",
        duration: 1200,
      },
      {
        id: "conception",
        label: "Conception de l'application",
        message:
          "Voici la structure retenue : un tableau de bord, des listes filtrables et des formulaires simples à utiliser.",
        duration: 1300,
      },
      {
        id: "interface",
        label: "Création de l'interface",
        message:
          "Je construis maintenant l'interface et la navigation de votre application.",
        duration: 1400,
      },
      {
        id: "fonctionnalites",
        label: "Mise en place des fonctionnalités",
        message:
          "J'ajoute les fonctionnalités principales : recherche, filtres, calculs et alertes.",
        duration: 1500,
      },
      {
        id: "base-de-donnees",
        label: "Création de la base de données",
        message:
          "La base SQLite est en place. Les données sont organisées pour rester rapides et cohérentes.",
        duration: 1200,
      },
      {
        id: "tests",
        label: "Tests",
        message:
          "Je lance les tests : formulaires, calculs, interactions et cohérence des données.",
        duration: 1100,
      },
      {
        id: "corrections",
        label: "Corrections",
        message:
          "J'ai corrigé deux détails détectés pendant les tests. Je relance une vérification.",
        duration: 1000,
      },
      {
        id: "livraison",
        label: "Préparation de la livraison",
        message:
          "Votre application est prête ! Testez-la dans l'aperçu, puis personnalisez-la par conversation.",
        duration: 1100,
      },
    ],
    intro:
      "Bonjour ! J'ai bien compris votre besoin. Je vais concevoir votre application pas à pas. Vous pouvez suivre chaque étape en temps réel.",
    replies: [
      {
        keywords: ["couleur", "thème", "theme", "apparence"],
        reply:
          "Bonne idée. Je peux adapter la couleur principale, les arrondis et la typographie. Dites-moi la teinte souhaitée et je l'applique.",
      },
      {
        keywords: ["export", "pdf", "excel"],
        reply:
          "Je peux ajouter un export PDF et Excel sur les produits et les mouvements. La fonctionnalité sera intégrée puis testée automatiquement.",
      },
      {
        keywords: ["graphique", "statistique", "chiffre"],
        reply:
          "J'ajoute un graphique de la valeur du stock sur les six derniers mois, avec un filtre par catégorie.",
      },
      {
        keywords: ["fournisseur", "client", "alerte", "stock"],
        reply:
          "C'est noté. Je vais relier cette information aux données existantes et vérifier que les calculs restent cohérents.",
      },
    ],
    defaultReply:
      "C'est noté. Dans la version complète, je modifierai directement l'application, puis je vérifierai que tout fonctionne avant de vous livrer la nouvelle version.",
  },
  stock: {
    products: [
      {
        id: "PRD-001",
        name: "Café Arabica 1 kg",
        category: "Épicerie",
        stock: 42,
        threshold: 10,
        price: 12.9,
        status: "inStock",
      },
      {
        id: "PRD-002",
        name: "Thé vert bio 250 g",
        category: "Boissons",
        stock: 4,
        threshold: 10,
        price: 8.5,
        status: "lowStock",
      },
      {
        id: "PRD-003",
        name: "Sucre de canne 1 kg",
        category: "Épicerie",
        stock: 0,
        threshold: 15,
        price: 3.2,
        status: "outOfStock",
      },
      {
        id: "PRD-004",
        name: "Huile d'olive 75 cl",
        category: "Épicerie",
        stock: 18,
        threshold: 8,
        price: 9.9,
        status: "inStock",
      },
      {
        id: "PRD-005",
        name: "Farine complète 1 kg",
        category: "Épicerie",
        stock: 6,
        threshold: 12,
        price: 2.8,
        status: "lowStock",
      },
      {
        id: "PRD-006",
        name: "Jus d'orange 1 L",
        category: "Boissons",
        stock: 31,
        threshold: 10,
        price: 3.6,
        status: "inStock",
      },
    ],
    alerts: [
      { name: "Thé vert bio 250 g", level: "low", count: 4 },
      { name: "Sucre de canne 1 kg", level: "out", count: 0 },
      { name: "Farine complète 1 kg", level: "low", count: 6 },
    ],
    chart: [
      { month: "Janv.", value: 24800, height: 52 },
      { month: "Févr.", value: 28300, height: 61 },
      { month: "Mars", value: 25100, height: 54 },
      { month: "Avr.", value: 33600, height: 71 },
      { month: "Mai", value: 38200, height: 82 },
      { month: "Juin", value: 42850, height: 94 },
    ],
  },
};

const en: DemoData = {
  companyName: "My Company",
  organizations: [
    { id: "ma-societe", name: "My Company", plan: "Pro plan" },
    { id: "espace-perso", name: "Personal space", plan: "Starter plan" },
  ],
  projects: [
    {
      id: "gestion-commerciale",
      name: "Sales Management",
      modified: "Modified 2 h ago",
      icon: "cube",
      prompt:
        "Open my Sales Management app and add a monthly sales tracker.",
    },
    {
      id: "planning-equipe",
      name: "Team Planning",
      modified: "Modified 1 day ago",
      icon: "calendar",
      prompt:
        "Open my Team Planning app and improve the task calendar view.",
    },
    {
      id: "suivi-budget",
      name: "Budget Tracking",
      modified: "Modified 2 days ago",
      icon: "chart",
      prompt:
        "Open my Budget Tracking app and add an expense chart by category.",
    },
    {
      id: "portail-clients",
      name: "Client Portal",
      modified: "Modified 3 days ago",
      icon: "users",
      prompt:
        "Open my Client Portal app and add a request tracking area.",
    },
  ],
  templates: [
    {
      id: "gestion-de-projet",
      name: "Project management",
      description: "Plan and track your projects",
      icon: "project",
      prompt:
        "Create a project management app with planning, tasks and progress tracking.",
    },
    {
      id: "facturation",
      name: "Invoicing",
      description: "Manage quotes and invoices",
      icon: "invoice",
      prompt:
        "Create an invoicing app with quotes, customers and PDF export.",
    },
    {
      id: "crm",
      name: "CRM",
      description: "Track customers and leads",
      icon: "crm",
      prompt:
        "Create a modern CRM to track my customers, leads, opportunities and follow-ups.",
    },
    {
      id: "tableau-de-bord",
      name: "Dashboard",
      description: "Visualize your data",
      icon: "dashboard",
      prompt:
        "Create a dashboard to visualize my sales data with charts and filters.",
    },
  ],
  features: [
    {
      title: "AI-assisted creation",
      description: "Just describe it, and you're off!",
      icon: "bolt",
      href: "/creer",
      accent: "amber",
    },
    {
      title: "Isolated environments",
      description: "Your projects, fully secure",
      icon: "shield",
      href: "/applications",
      accent: "brand",
    },
    {
      title: "Exportable apps",
      description: "Desktop, Web or Mobile",
      icon: "rocket",
      href: "/modeles",
      accent: "brand",
    },
    {
      title: "Responsive support",
      description: "We're here for you",
      icon: "headset",
      href: "/aide",
      accent: "brand",
    },
  ],
  baseSuggestions: [
    {
      label: "Stock management",
      prompt:
        "Create a stock management app with inbound/outbound tracking and low-stock alerts.",
      icon: "stock",
    },
    {
      label: "Invoicing",
      prompt:
        "Create an invoicing app with quotes, customers and PDF export.",
      icon: "invoice",
    },
    {
      label: "CRM",
      prompt:
        "Create a modern CRM to track my leads, opportunities and follow-ups.",
      icon: "crm",
    },
    {
      label: "Planning",
      prompt:
        "Create a team planning app with a calendar view and task assignment.",
      icon: "planning",
    },
  ],
  extraSuggestions: [
    {
      label: "Project management",
      prompt:
        "Create a project management app with tasks, deadlines and progress tracking.",
      icon: "project",
    },
    {
      label: "Bookings",
      prompt:
        "Create a booking app with a calendar, availability and email confirmations.",
      icon: "booking",
    },
    {
      label: "Production tracking",
      prompt:
        "Create a production tracking app with work orders and quality control.",
      icon: "production",
    },
    {
      label: "Expense management",
      prompt:
        "Create an expense management app with receipts, categories and Excel export.",
      icon: "expenses",
    },
  ],
  notifications: [
    {
      id: "notif-1",
      title: "App updated",
      description: "Sales Management was updated successfully.",
      time: "12 min ago",
      icon: "success",
      unread: true,
    },
    {
      id: "notif-2",
      title: "AI credits used",
      description: "3 credits were used during the last change.",
      time: "1 h ago",
      icon: "credits",
      unread: true,
    },
    {
      id: "notif-3",
      title: "Backup complete",
      description: "Your project backup is available.",
      time: "Yesterday",
      icon: "success",
      unread: false,
    },
  ],
  defaultPrompt:
    "Create a stock management app with search and PDF export.",
  generation: {
    steps: [
      {
        id: "analyse",
        label: "Understanding your request",
        message:
          "I've analyzed your request. I'll create a clear app tailored to your business that you can use right away.",
        duration: 1200,
      },
      {
        id: "conception",
        label: "Designing the app",
        message:
          "Here's the structure: a dashboard, filterable lists and simple forms.",
        duration: 1300,
      },
      {
        id: "interface",
        label: "Building the interface",
        message:
          "I'm now building your app's interface and navigation.",
        duration: 1400,
      },
      {
        id: "fonctionnalites",
        label: "Implementing features",
        message:
          "I'm adding the core features: search, filters, calculations and alerts.",
        duration: 1500,
      },
      {
        id: "base-de-donnees",
        label: "Creating the database",
        message:
          "The SQLite database is ready. Your data is organized to stay fast and consistent.",
        duration: 1200,
      },
      {
        id: "tests",
        label: "Testing",
        message:
          "I'm running tests: forms, calculations, interactions and data consistency.",
        duration: 1100,
      },
      {
        id: "corrections",
        label: "Fixing issues",
        message:
          "I fixed two details found during testing. Running another check now.",
        duration: 1000,
      },
      {
        id: "livraison",
        label: "Preparing delivery",
        message:
          "Your app is ready! Try it in the preview, then customize it through conversation.",
        duration: 1100,
      },
    ],
    intro:
      "Hello! I understand what you need. I'll design your app step by step. You can follow every stage in real time.",
    replies: [
      {
        keywords: ["color", "colour", "theme", "appearance"],
        reply:
          "Good idea. I can adjust the primary color, corner radius and typography. Tell me the shade you want and I'll apply it.",
      },
      {
        keywords: ["export", "pdf", "excel"],
        reply:
          "I can add PDF and Excel export for products and movements. The feature will be implemented and tested automatically.",
      },
      {
        keywords: ["chart", "statistics", "number"],
        reply:
          "I'll add a stock value chart for the last six months, with a category filter.",
      },
      {
        keywords: ["supplier", "customer", "alert", "stock"],
        reply:
          "Noted. I'll connect this information to the existing data and make sure the calculations stay consistent.",
      },
    ],
    defaultReply:
      "Noted. In the full version, I'll modify the app directly, then verify everything works before delivering the new version.",
  },
  stock: {
    products: [
      {
        id: "PRD-001",
        name: "Arabica Coffee 1 kg",
        category: "Grocery",
        stock: 42,
        threshold: 10,
        price: 12.9,
        status: "inStock",
      },
      {
        id: "PRD-002",
        name: "Organic Green Tea 250 g",
        category: "Beverages",
        stock: 4,
        threshold: 10,
        price: 8.5,
        status: "lowStock",
      },
      {
        id: "PRD-003",
        name: "Cane Sugar 1 kg",
        category: "Grocery",
        stock: 0,
        threshold: 15,
        price: 3.2,
        status: "outOfStock",
      },
      {
        id: "PRD-004",
        name: "Olive Oil 75 cl",
        category: "Grocery",
        stock: 18,
        threshold: 8,
        price: 9.9,
        status: "inStock",
      },
      {
        id: "PRD-005",
        name: "Whole Wheat Flour 1 kg",
        category: "Grocery",
        stock: 6,
        threshold: 12,
        price: 2.8,
        status: "lowStock",
      },
      {
        id: "PRD-006",
        name: "Orange Juice 1 L",
        category: "Beverages",
        stock: 31,
        threshold: 10,
        price: 3.6,
        status: "inStock",
      },
    ],
    alerts: [
      { name: "Organic Green Tea 250 g", level: "low", count: 4 },
      { name: "Cane Sugar 1 kg", level: "out", count: 0 },
      { name: "Whole Wheat Flour 1 kg", level: "low", count: 6 },
    ],
    chart: [
      { month: "Jan", value: 24800, height: 52 },
      { month: "Feb", value: 28300, height: 61 },
      { month: "Mar", value: 25100, height: 54 },
      { month: "Apr", value: 33600, height: 71 },
      { month: "May", value: 38200, height: 82 },
      { month: "Jun", value: 42850, height: 94 },
    ],
  },
};

export function getDemoData(locale: Locale): DemoData {
  return locale === "en" ? en : fr;
}
