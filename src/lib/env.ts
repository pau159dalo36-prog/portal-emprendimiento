type RequiredPublicEnvVar = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

function requireEnv(name: RequiredPublicEnvVar): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Falta la variable de entorno "${name}". Configúrala en .env.local o en el proveedor de despliegue (consulta .env.example).`,
    );
  }

  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
