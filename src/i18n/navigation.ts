import { createNavigation } from "next-intl/navigation";
import type { UrlObject } from "url";

import { routing } from "./routing";

// Con `pathnames` definido, next-intl tipa los hrefs SOLO a las rutas
// declaradas (navegación estricta) y rompe los enlaces que usan template
// strings (p. ej. `/perfil/${username}`). El código existente usa hrefs libres,
// así que exponemos una navegación con TIPOS flexibles: el runtime SÍ traduce
// /explorar → /explore según el locale y el middleware resuelve ambas formas.
type LooseHref = string | UrlObject;
type LooseHrefWithQuery = string | { pathname: string; query?: Record<string, unknown> };

const nav = createNavigation(routing);

type LinkProps = Omit<import("react").ComponentProps<"a">, "href"> & {
  href: LooseHref;
  locale?: string;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
  prefetch?: boolean | "auto" | null;
};

type RouterOptions = {
  locale?: string;
} & Record<string, unknown>;

type Router = {
  push: (href: LooseHrefWithQuery, options?: RouterOptions) => void;
  replace: (href: LooseHrefWithQuery, options?: RouterOptions) => void;
  prefetch: (href: LooseHrefWithQuery, options?: RouterOptions) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
};

type NavigateArgs = {
  href: LooseHrefWithQuery;
  locale: string;
  forcePrefix?: boolean;
};

export const Link = nav.Link as unknown as import("react").ForwardRefExoticComponent<
  LinkProps & import("react").RefAttributes<HTMLAnchorElement>
>;

export const useRouter = nav.useRouter as unknown as () => Router;

export const usePathname = nav.usePathname as unknown as () => string;

export const redirect = nav.redirect as unknown as (
  args: NavigateArgs,
  type?: "push" | "replace",
) => never;

export const permanentRedirect = nav.permanentRedirect as unknown as (
  args: NavigateArgs,
  type?: "push" | "replace",
) => never;

export const getPathname = nav.getPathname as unknown as (args: NavigateArgs) => string;
