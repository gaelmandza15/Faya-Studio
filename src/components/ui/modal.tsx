"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { dict } = useI18n();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={dict.common.close}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm animate-in fade-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0e151b] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id={titleId}
              className="text-[15px] font-semibold text-white"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.common.close}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">{children}</div>

        {footer && (
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
