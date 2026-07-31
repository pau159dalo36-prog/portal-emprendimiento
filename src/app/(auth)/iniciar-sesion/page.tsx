import Link from "next/link";
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

export const metadata = {
  title: "Iniciar sesión — Portal de Emprendimiento",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ contrasena?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Accede a tu cuenta para continuar con tu proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {params.contrasena === "actualizada" && (
            <FormMessage status="success">
              Tu contraseña se actualizó correctamente. Inicia sesión con la nueva
              contraseña.
            </FormMessage>
          )}
          {params.error && (
            <FormMessage status="error">
              No se pudo completar la acción. Inténtalo de nuevo.
            </FormMessage>
          )}
          <SignInForm />
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            ¿Aún no tienes una cuenta?{" "}
            <Link
              href="/registrarse"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Crea una gratis
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
