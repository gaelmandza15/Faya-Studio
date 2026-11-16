import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/placeholders/section-placeholder";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.templates };
}

export default function ModelesPage() {
  return <SectionPlaceholder sectionKey="modeles" />;
}
