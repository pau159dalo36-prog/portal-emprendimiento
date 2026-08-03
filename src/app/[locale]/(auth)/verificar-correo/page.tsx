import { getTranslations } from "next-intl/server";
import { MailCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("verifyEmail") };
}

export default async function CheckEmailPage() {
  const t = await getTranslations("auth.verify");

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader className="items-center text-center">
          <span
            aria-hidden="true"
            className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <MailCheck className="size-6" />
          </span>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>{t("notFound")}</p>
        </CardContent>
        <CardFooter className="flex-col gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t("confirmed")}{" "}
            <Link
              href="/iniciar-sesion"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("signIn")}
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            {t("notYourEmail")}{" "}
            <Link
              href="/registrarse"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("createNew")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
