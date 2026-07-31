import Link from "next/link";

import { signOutAction } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";

export function SignedInNav() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/panel" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Panel
      </Link>
      <Link
        href="/configuracion/perfil"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Editar perfil
      </Link>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
