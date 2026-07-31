# Sistema de diseño

## Principios

- **Claridad**: Interfaces limpias sin ruido visual.
- **Consistencia**: Un solo sistema de tokens para colores, tipografía y espaciado.
- **Accesibilidad**: Contraste suficiente, soporte de teclado y roles ARIA.

## Tokens de diseño

### Colores (modo claro / oscuro)
- **Background**: `oklch(1 0 0)` / `oklch(0.145 0 0)`
- **Foreground**: `oklch(0.145 0 0)` / `oklch(0.985 0 0)`
- **Primary**: `oklch(0.205 0 0)` / `oklch(0.922 0 0)` (negro/blanco)
- **Border**: `oklch(0.922 0 0)` / `oklch(1 0 0 / 10%)`

### Tipografía
- **Sans-serif**: Inter (variable `--font-sans`)
- **Mono**: Geist Mono (variable `--font-geist-mono`)
- **Escala**: 14px (sm), 16px (base), 18px (lg), 24px (2xl), 30px (3xl), 36px (4xl)

### Radios
- **sm**: 0.375rem (6px)
- **md**: 0.5rem (8px)
- **lg**: 0.625rem (10px)
- **xl**: 0.875rem (14px)
- **2xl**: 1.125rem (18px)
- **3xl**: 1.375rem (22px)
- **4xl**: 1.625rem (26px)

## Componentes

### shadcn/ui (base-luma style)
- **Button**: Basado en `@base-ui/react/button` con variantes default, outline, secondary, ghost, destructive, link.
- Se añadirán según necesidad: Input, Card, Dialog, Avatar, Badge, Textarea.

### Patrones de UI
- **Cards**: Bordes sutiles, sombras ligeras, hover con elevación.
- **Gradientes de fondo**: Radial sutiles en secciones hero.
- **Efectos de cristal**: `backdrop-blur` en cabeceras y secciones destacadas.

## Responsive

- **Mobile first**: Diseñado desde 320px hacia arriba.
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px).
- Navegación colapsable en móvil.
