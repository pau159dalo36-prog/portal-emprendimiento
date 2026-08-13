// Visuales compartidos para tarjetas de proyectos (etapa, gradientes de
// portada y utilidades). Los usan tanto las tarjetas server (project-video-card)
// como las de exploración (client) para mantener un único aspecto visual.
export const PROJECT_STAGE_DOTS: Record<string, string> = {
  idea: "bg-sky-400",
  validacion: "bg-amber-400",
  prototipo: "bg-violet-400",
  lanzamiento: "bg-emerald-400",
  crecimiento: "bg-rose-400",
};

export const PROJECT_FALLBACK_GRADIENTS = [
  "from-slate-900 via-slate-800 to-slate-600",
  "from-indigo-950 via-indigo-900 to-slate-800",
  "from-teal-950 via-teal-900 to-slate-800",
  "from-rose-950 via-rose-900 to-slate-800",
  "from-amber-950 via-amber-900 to-slate-800",
  "from-violet-950 via-violet-900 to-slate-800",
] as const;

export function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function isOptimizableCover(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return true;
    }
    return new URL(supabaseUrl).hostname === hostname;
  } catch {
    return false;
  }
}
