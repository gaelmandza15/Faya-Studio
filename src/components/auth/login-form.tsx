"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";
import { FormField } from "@/components/auth/form-field";
import { loginAction, type AuthState } from "@/app/actions/auth";
import { useI18n } from "@/i18n/provider";

const initialState: AuthState = {};

export function LoginForm({ next }: { next?: string }) {
  const { dict } = useI18n();
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );
  const error = state.error ? dict.auth.errors[state.error] : null;

  return (
    <div className="w-full max-w-md">
      <div className="mb-7">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#1be67a]">
          {dict.common.appName}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          {dict.auth.loginTitle}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">
          {dict.auth.loginSubtitle}
        </p>
      </div>

      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
      >
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-300"
          >
            {error}
          </div>
        )}

        {next && <input type="hidden" name="next" value={next} />}

        <FormField
          label={dict.auth.email}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          required
          autoFocus
        />
        <FormField
          label={dict.auth.password}
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />

        <button
          type="submit"
          disabled={isPending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1be67a] text-[13.5px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a] disabled:cursor-wait disabled:opacity-70"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {isPending ? dict.auth.signingIn : dict.auth.signIn}
        </button>
      </form>

      <div className="mt-4 rounded-xl border border-[#1be67a]/20 bg-[#1be67a]/5 px-4 py-3">
        <p className="text-[11.5px] font-semibold text-white">
          {dict.auth.demoTitle}
        </p>
        <p className="mt-1 font-mono text-[11.5px] text-slate-400">
          {dict.auth.demoHint}
        </p>
      </div>

      <p className="mt-6 text-center text-[12.5px] text-slate-400">
        {dict.auth.noAccount}{" "}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="font-medium text-[#1be67a] transition hover:underline"
        >
          {dict.auth.goToRegister}
        </Link>
      </p>
    </div>
  );
}
