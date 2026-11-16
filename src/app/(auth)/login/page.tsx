import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.login };
}

export default function LoginPage() {
  return <LoginForm />;
}
