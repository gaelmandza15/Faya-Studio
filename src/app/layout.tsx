import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/provider";
import { getI18n } from "@/i18n/server";

// The interface locale is resolved from a cookie (with Accept-Language as a
// fallback), so the root layout is intentionally request-bound.
export const instant = false;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();

  return {
    title: {
      default: dict.meta.title,
      template: `%s · ${dict.common.appName}`,
    },
    description: dict.meta.description,
    applicationName: dict.common.appName,
  };
}

export const viewport: Viewport = {
  themeColor: "#090e12",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dict } = await getI18n();

  return (
    <html
      lang={locale}
      className={`dark ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-night font-sans text-slate-100">
        <I18nProvider locale={locale} dict={dict}>
          <TooltipProvider delay={200}>{children}</TooltipProvider>
        </I18nProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
