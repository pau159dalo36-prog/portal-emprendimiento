import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function AuthActions() {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/iniciar-sesion"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Iniciar sesión
      </Link>
      <Link href="/registrarse" className={buttonVariants({ size: "sm" })}>
        Crear cuenta
      </Link>
    </div>
  );
}
