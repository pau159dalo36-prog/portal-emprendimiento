# Portal de emprendimiento

Este proyecto es una base de Next.js para un portal independiente de emprendimiento orientado a publicar ideas, recibir feedback, validar proyectos, encontrar colaboradores y acceder a oportunidades.

## Stack

- Next.js con App Router
- TypeScript estricto
- Tailwind CSS
- shadcn/ui
- Zod
- Vercel

## Arquitectura

- Los componentes de servidor son la opción por defecto.
- La interfaz se organiza en componentes reutilizables para landing, secciones y tarjetas.
- La estructura está preparada para incorporar Supabase Auth, PostgreSQL y Storage en fases posteriores, sin depender de Nexora.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Estructura principal

- src/app: páginas y layout principal
- src/components: componentes reutilizables de interfaz
- src/lib: utilidades compartidas
