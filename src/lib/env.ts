const LOCALHOST_SITE_URL = "http://localhost:3000";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno "${name}". Configúrala en .env.local o en el proveedor de despliegue (consulta .env.example).`,
    );
  }

  return value;
}

function normalizeSiteUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL no es una URL válida: "${value}". Revisa el valor configurado.`,
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL debe usar http o https. Valor configurado: "${value}".`,
    );
  }

  if (!url.hostname) {
    throw new Error(`NEXT_PUBLIC_SITE_URL no tiene un host válido: "${value}".`);
  }

  if (url.username || url.password) {
    throw new Error(`NEXT_PUBLIC_SITE_URL no debe contener credenciales.`);
  }

  url.hash = "";
  url.search = "";

  return (url.origin + url.pathname).replace(/\/+$/, "");
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabasePublishableKey(): string {
  return requireEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) {
    return normalizeSiteUrl(configured);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      'Falta la variable de entorno "NEXT_PUBLIC_SITE_URL". Configúrala en el proveedor de despliegue, por ejemplo https://TU-SITIO.netlify.app (consulta .env.example y docs/NETLIFY.md).',
    );
  }

  return LOCALHOST_SITE_URL;
}
