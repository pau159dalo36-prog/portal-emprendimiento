export const brand = {
  name: "Ideora",
  shortName: "Ideora",
  tagline: "Comparte, descubre y construye.",
  description:
    "Plataforma independiente para publicar ideas, recibir feedback estructurado, validar proyectos y encontrar colaboradores afines.",
  defaultTitle: "Ideora — Comparte, descubre y construye.",
  defaultDescription:
    "Comparte tus ideas, descubre oportunidades y construye proyectos con una comunidad que valida, no solo opina.",
  logoMark: "I",
  social: {
    twitter: "@ideora",
    github: "https://github.com/pau159dalo36-prog/portal-emprendimiento",
  },
  links: {
    registrar: "/registrarse",
    iniciarSesion: "/iniciar-sesion",
    panel: "/panel",
    onboarding: "/onboarding",
    perfil: "/perfil",
    configuracionPerfil: "/configuracion/perfil",
    configuracionIdioma: "/configuracion/idioma",
    proyectos: "/proyectos",
    organizaciones: "/organizaciones",
    nuevoProyecto: "/proyectos/nuevo",
    nuevaOrganizacion: "/organizaciones/nueva",
  },
} as const;

export type Brand = typeof brand;

export function pageTitle(title: string): string {
  return `${title} — ${brand.name}`;
}
