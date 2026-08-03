import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function AuthActions() {
  const t = await getTranslations("nav");

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/iniciar-sesion"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {t("signIn")}
      </Link>
      <Link href="/registrarse" className={buttonVariants({ size: "sm" })}>
        {t("createAccount")}
      </Link>
    </div>
  );
}
