import { getTranslations } from "next-intl/server";
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
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("updatePassword") };
}

async function ResetLinkIssueCard({ kind }: { kind: "expired" | "technical" }) {
  const t = await getTranslations("auth.update");

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
            {kind === "expired" ? t("expiredTitle") : t("technicalTitle")}
          </CardTitle>
          <CardDescription>
            {kind === "expired" ? t("expiredDescription") : t("technicalDescription")}
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

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  if (error === "expired") {
    return <ResetLinkIssueCard kind="expired" />;
  }

  if (error === "technical") {
    return <ResetLinkIssueCard kind="technical" />;
  }

  const { user } = await getCurrentUser();

  // Sin sesión de recuperación (cookie ausente o expirada) NO redirigimos a
  // /recuperar-contrasena: ese auto-redirect creaba el bucle. Mostramos la
  // tarjeta técnica con la opción de solicitar un enlace nuevo.
  if (!user) {
    return <ResetLinkIssueCard kind="technical" />;
  }

  const t = await getTranslations("auth.update");

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
