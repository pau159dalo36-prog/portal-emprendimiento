import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/auth/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("signIn") };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ contrasena?: string; error?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth.signIn");

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {params.contrasena === "actualizada" && (
            <FormMessage status="success">{t("passwordUpdated")}</FormMessage>
          )}
          {params.error && (
            <FormMessage status="error">{t("actionError")}</FormMessage>
          )}
          <SignInForm />
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              href="/registrarse"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("createFree")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
