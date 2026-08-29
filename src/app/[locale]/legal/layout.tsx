import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-10">
      <nav className="mb-8">
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; {t("backToHome")}
        </Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}