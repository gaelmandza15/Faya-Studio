import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/placeholders/section-placeholder";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.help };
}

export default function AidePage() {
  return <SectionPlaceholder sectionKey="aide" />;
}
