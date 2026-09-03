import { getTranslations } from "next-intl/server";
import { Languages, ShieldCheck, Video } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function SignedInNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const t = await getTranslations("nav");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/proyectos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        {t("projects")}
      </Link>
      <Link href="/organizaciones" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        {t("organizations")}
      </Link>
      <Link href="/panel/videos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <Video className="size-4" aria-hidden="true" />
        {t("myVideos")}
      </Link>
      {isAdmin && (
        <>
          <Link href="/admin/videos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t("adminVideos")}
          </Link>
          <Link href="/admin/oportunidades" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t("adminOpportunities")}
          </Link>
          <Link href="/admin/servicios" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t("adminServices")}
          </Link>
          <Link href="/admin/reportes" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t("adminReports")}
          </Link>
        </>
      )}
      <Link href="/panel" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        {t("panel")}
      </Link>
      <Link
        href="/configuracion/perfil"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {t("editProfile")}
      </Link>
      <Link
        href="/configuracion/idioma"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        title={t("language")}
      >
        <Languages aria-hidden="true" />
        {t("language")}
      </Link>
      <SignOutButton className="text-muted-foreground">{t("signOut")}</SignOutButton>
    </div>
  );
}
