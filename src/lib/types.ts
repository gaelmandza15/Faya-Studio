export type ProjectIcon = "cube" | "calendar" | "chart" | "users";

export type ProjectStatus = "generating" | "ready" | "error";

export interface Project {
  id: string;
  name: string;
  modified: string;
  icon: ProjectIcon;
  prompt: string;
  status?: ProjectStatus;
  href?: string;
}

export type TemplateIcon = "project" | "invoice" | "crm" | "dashboard";

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  icon: TemplateIcon;
  prompt: string;
}

export type FeatureIcon = "bolt" | "shield" | "rocket" | "headset";

export interface Feature {
  title: string;
  description: string;
  icon: FeatureIcon;
  href: string;
  accent: "amber" | "brand";
}

export type SuggestionIcon =
  | "stock"
  | "invoice"
  | "crm"
  | "planning"
  | "project"
  | "booking"
  | "production"
  | "expenses";

export interface PromptSuggestion {
  label: string;
  prompt: string;
  icon: SuggestionIcon;
}

export type NotificationIcon = "success" | "credits";

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  icon: NotificationIcon;
  unread: boolean;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
}

export type GenerationStatus = "running" | "done" | "error";

export type PreviewDevice = "desktop" | "mobile";

export interface GenerationStep {
  id: string;
  label: string;
  message: string;
  duration: number;
}

export type ChatRole = "agent" | "user";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export type StockStatus = "inStock" | "lowStock" | "outOfStock";

export interface StockProduct {
  id: string;
  name: string;
  category: string;
  stock: number;
  threshold: number;
  price: number;
  status: StockStatus;
}

export interface StockAlert {
  name: string;
  level: "low" | "out";
  count: number;
}

export interface StockChartPoint {
  month: string;
  value: number;
  height: number;
}

export interface AgentReply {
  keywords: string[];
  reply: string;
}

export interface DemoData {
  companyName: string;
  organizations: Organization[];
  projects: Project[];
  templates: AppTemplate[];
  features: Feature[];
  baseSuggestions: PromptSuggestion[];
  extraSuggestions: PromptSuggestion[];
  notifications: AppNotification[];
  defaultPrompt: string;
  generation: {
    steps: GenerationStep[];
    intro: string;
    replies: AgentReply[];
    defaultReply: string;
  };
  stock: {
    products: StockProduct[];
    alerts: StockAlert[];
    chart: StockChartPoint[];
  };
}

export interface WorkspaceUser {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  email: string;
}

export interface WorkspaceOrganization {
  id: string;
  name: string;
  plan: string;
  credits: number;
}

export interface WorkspaceData {
  user: WorkspaceUser;
  organization: WorkspaceOrganization;
  organizations: WorkspaceOrganization[];
}
