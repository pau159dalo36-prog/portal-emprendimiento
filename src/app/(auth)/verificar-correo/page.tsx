import Link from "next/link";
import { MailCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Confirma tu correo — Portal de Emprendimiento",
};

export default function CheckEmailPage() {
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
          <CardTitle>Revisa tu correo</CardTitle>
          <CardDescription>
            Te hemos enviado un enlace de confirmación. Abre el correo para activar tu
            cuenta y empezar con tu perfil.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>¿No lo encuentras? Revisa la carpeta de spam o promociones.</p>
        </CardContent>
        <CardFooter className="flex-col gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya confirmaste tu cuenta?{" "}
            <Link
              href="/iniciar-sesion"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Inicia sesión
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            ¿No es tu correo?{" "}
            <Link
              href="/registrarse"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Crea una cuenta nueva
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
