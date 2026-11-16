import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.register };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
