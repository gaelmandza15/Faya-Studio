import type { FeatureIcon, ProjectIcon, TemplateIcon } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProjectGlyph({
  icon,
  className,
}: {
  icon: ProjectIcon;
  className?: string;
}) {
  if (icon === "cube") {
    return (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("h-8 w-8", className)}>
        <path d="M16 3L28 9.5V22.5L16 29L4 22.5V9.5L16 3Z" fill="#2563eb" />
        <path d="M16 3L28 9.5L16 16L4 9.5L16 3Z" fill="#60a5fa" />
        <path d="M16 16L28 9.5V22.5L16 29V16Z" fill="#1d4ed8" />
      </svg>
    );
  }

  if (icon === "calendar") {
    return (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("h-8 w-8", className)}>
        <rect x="4" y="6" width="24" height="22" rx="4" fill="#a855f7" />
        <path d="M4 10a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v3H4v-3z" fill="#c084fc" />
        <rect x="9" y="3" width="3" height="6" rx="1.5" fill="#e9d5ff" />
        <rect x="20" y="3" width="3" height="6" rx="1.5" fill="#e9d5ff" />
        <rect x="8" y="16" width="4" height="4" rx="1" fill="#f3e8ff" />
        <rect x="14" y="16" width="4" height="4" rx="1" fill="#f3e8ff" />
        <rect x="20" y="16" width="4" height="4" rx="1" fill="#f3e8ff" />
      </svg>
    );
  }

  if (icon === "chart") {
    return (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("h-8 w-8", className)}>
        <rect x="4" y="18" width="5" height="9" rx="1.5" fill="#16a34a" />
        <rect x="11" y="13" width="5" height="14" rx="1.5" fill="#22c55e" />
        <rect x="18" y="8" width="5" height="19" rx="1.5" fill="#4ade80" />
        <path
          d="M5 13l7-4 5 2 8-6"
          stroke="#86efac"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("h-8 w-8", className)}>
      <circle cx="12" cy="11" r="4.5" fill="#f97316" />
      <path d="M4 25c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" fill="#f97316" />
      <circle cx="22" cy="13" r="3.5" fill="#fb923c" />
      <path d="M21 25h7c0-3.5-2.7-6-6-6-.8 0-1.5.15-2.2.4" fill="#fb923c" />
    </svg>
  );
}

export function TemplateGlyph({
  icon,
  className,
}: {
  icon: TemplateIcon;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: cn("h-5 w-5", className),
  };

  if (icon === "project") {
    return (
      <svg {...common}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }

  if (icon === "invoice") {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </svg>
    );
  }

  if (icon === "crm") {
    return (
      <svg {...common}>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M17 14a4.5 4.5 0 0 1 4 4.5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 3v18h18" />
      <path d="M7 16v-4M12 16V8M17 16v-6" />
    </svg>
  );
}

export function FeatureGlyph({
  icon,
  className,
}: {
  icon: FeatureIcon;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: cn("h-8 w-8 shrink-0", className),
  };

  if (icon === "bolt") {
    return (
      <svg {...common}>
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    );
  }

  if (icon === "shield") {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }

  if (icon === "rocket") {
    return (
      <svg {...common}>
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}
