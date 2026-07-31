import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/auth/session";

export const metadata = {
  title: "Actualizar contraseña — Portal de Emprendimiento",
};

export default async function UpdatePasswordPage() {
  const { user } = await getCurrentUser();

  if (!user) {
    redirect("/recuperar-contrasena");
  }

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Actualizar contraseña</CardTitle>
          <CardDescription>
            Elige una contraseña nueva para tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
