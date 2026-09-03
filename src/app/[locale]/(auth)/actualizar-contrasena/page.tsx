import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/auth/session";
import { pageMetadataTitle } from "@/i18n/metadata";
import { getPathname, Link } from "@/i18n/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("updatePassword") };
}

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getCurrentUser();
  const t = await getTranslations("auth.update");
  const locale = await getLocale();

  if (!user) {
    redirect(getPathname({ href: "/recuperar-contrasena", locale }));
  }

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  if (error === "expired" || error === "technical") {
    return (
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="items-center text-center">
            <span
              aria-hidden="true"
              className="mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            >
              <AlertTriangle className="size-6" />
            </span>
            <CardTitle>
              {error === "expired" ? t("expiredTitle") : t("technicalTitle")}
            </CardTitle>
            <CardDescription>
              {error === "expired" ? t("expiredDescription") : t("technicalDescription")}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link
              href="/recuperar-contrasena"
              className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("requestNewLink")}
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
