"use client";

import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export function EditorLoading() {
  const { dict } = useI18n();

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-[#1be67a]" />
        {dict.editor.loading}
      </div>
    </div>
  );
}
