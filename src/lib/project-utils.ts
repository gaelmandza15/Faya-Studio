import type { ProjectIcon } from "@/lib/types";

export const PROJECT_ICONS: ProjectIcon[] = [
  "cube",
  "calendar",
  "chart",
  "users",
];

export function toProjectIcon(
  value: string | null | undefined,
): ProjectIcon {
  if (value && PROJECT_ICONS.includes(value as ProjectIcon)) {
    return value as ProjectIcon;
  }

  return "cube";
}
