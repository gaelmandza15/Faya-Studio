import {
  Boxes,
  Coins,
  FolderKanban,
  LayoutGrid,
  LifeBuoy,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type SectionKey =
  | "projets"
  | "applications"
  | "modeles"
  | "credits"
  | "parametres"
  | "aide";

export const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  projets: FolderKanban,
  applications: LayoutGrid,
  modeles: Boxes,
  credits: Coins,
  parametres: Settings,
  aide: LifeBuoy,
};
