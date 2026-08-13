import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "always",
  pathnames: {
    // El hub de descubrimiento usa nombre por idioma: /explorar (es) y
    // /explore (en). El href interno SIEMPRE es /explorar; next-intl traduce
    // el path visible y el middleware lo resuelve de vuelta en la request.
    "/explorar": {
      es: "/explorar",
      en: "/explore",
    },
  },
});

export type Locale = (typeof routing.locales)[number];
