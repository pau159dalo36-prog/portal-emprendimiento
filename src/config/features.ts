export const features = {
  /**
   * La plataforma está construida por fases. Este mapa declara qué áreas
   * del producto están operativas en cada momento para guiar la UI, el SEO
   * y la documentación. Se activa cada capacidad al completar su fase.
   */
  capabilities: {
    autenticacion: true,
    onboarding: true,
    perfilPublico: true,
    avatares: true,
    idioma: true,
    organizaciones: false,
    proyectos: false,
    videos: false,
    publicaciones: false,
    feed: false,
    explorar: false,
    busqueda: false,
    oportunidades: false,
    empleos: false,
    cofundadores: false,
    freelancers: false,
    servicios: false,
    financiacion: false,
    clientesPiloto: false,
    candidaturas: false,
    equipos: false,
    comentarios: false,
    feedback: false,
    reacciones: false,
    guardados: false,
    mensajeria: false,
    notificaciones: false,
    comunidades: false,
    eventos: false,
    retos: false,
    moderacion: false,
    administracion: false,
    privacidad: false,
    analitica: false,
    seo: false,
    accesibilidad: false,
  },
} as const;

export type FeatureCapability = keyof typeof features.capabilities;

export function isEnabled(capability: FeatureCapability): boolean {
  return features.capabilities[capability];
}
