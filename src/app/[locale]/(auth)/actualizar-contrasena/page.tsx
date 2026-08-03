import { getLocale, getTranslations } from "next-intl/server";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/auth/session";
import { pageMetadataTitle } from "@/i18n/metadata";
import { getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("updatePassword") };
}

export default async function UpdatePasswordPage() {
  const { user } = await getCurrentUser();
  const t = await getTranslations("auth.update");

  if (!user) {
    redirect(getPathname({ href: "/recuperar-contrasena", locale: await getLocale() }));
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
