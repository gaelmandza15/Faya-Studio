"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  hint,
  id,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  label: string;
  hint?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400"
      >
        {label}
      </label>
      <input
        id={fieldId}
        aria-describedby={hintId}
        className={cn(
          "h-11 w-full rounded-xl border border-white/10 bg-[#0b1116] px-3.5 text-[13.5px] text-white outline-none transition placeholder:text-slate-600 focus:border-[#1be67a]/60 focus:ring-2 focus:ring-[#1be67a]/10",
          className,
        )}
        {...props}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-[11px] text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
