import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { cleanRecoveryPageParams } from "@/lib/supabase/recovery-url";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // En Netlify/OpenNext el redirect 307 del Route Handler de recovery puede
  // re-inyectar la query original (token_hash/type) en la URL de destino.
  // El token YA fue consumido en /auth/reset-password; aquí hacemos un redirect
  // final a una URL sin esos parámetros para que el navegador no los vea.
  // Netlify NO re-añade query a los redirects del middleware (solo a los de las
  // funciones), así que con un único salto la URL queda limpia.
  const cleanRecoveryUrl = cleanRecoveryPageParams(request.url);
  if (cleanRecoveryUrl) {
    return NextResponse.redirect(new URL(cleanRecoveryUrl));
  }

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api") || pathname.startsWith("/auth");
  const intlResponse = isApiRoute ? undefined : intlMiddleware(request);

  return updateSession(request, intlResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
