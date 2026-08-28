// Constantes del dominio de servicios profesionales (FASE 7). Los valores
// reflejan exactamente los CHECK constraints de la migración
// supabase/migrations/20260823000000_fase7_servicios.sql. Cualquier cambio aquí
// debe ir acompañado del CHECK correspondiente en SQL.

export const SERVICE_CATEGORIES = [
  "desarrollo_web",
  "diseno",
  "marketing",
  "fotografia_video",
  "consultoria",
  "mentoria",
  "formacion",
  "otros",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_DELIVERY_MODES = ["remote", "on_site", "hybrid"] as const;
export type ServiceDeliveryMode = (typeof SERVICE_DELIVERY_MODES)[number];

// Tipos de precio simples. Sin pagos: el precio es solo señal informativa.
export const SERVICE_PRICING_TYPES = [
  "fixed",
  "hourly",
  "range",
  "negotiable",
  "free",
] as const;
export type ServicePricingType = (typeof SERVICE_PRICING_TYPES)[number];

// fixed/hourly exigen amount + moneda; range exige min/max + moneda;
// negotiable/free prohíben cantidades y moneda (ver pricing_shape_check).
export const SERVICE_AMOUNT_PRICING_TYPES = ["fixed", "hourly"] as const;
export const SERVICE_RANGE_PRICING_TYPES = ["range"] as const;

export const SERVICE_STATUSES = [
  "draft",
  "published",
  "paused",
  "archived",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_VISIBILITIES = ["public", "registered_users"] as const;
export type ServiceVisibility = (typeof SERVICE_VISIBILITIES)[number];

export const SERVICE_MODERATION_STATUSES = [
  "unreviewed",
  "approved",
  "flagged",
  "rejected",
] as const;
export type ServiceModerationStatus =
  (typeof SERVICE_MODERATION_STATUSES)[number];

// Transiciones de ciclo de vida admitidas por el trigger services_validate_
// state_change: draft→published, published⇄paused, published/paused→archived.
export const SERVICE_STATUS_TRANSITIONS: Record<
  ServiceStatus,
  readonly ServiceStatus[]
> = {
  draft: ["published"],
  published: ["paused", "archived"],
  paused: ["published", "archived"],
  archived: [],
};

export const SERVICE_TITLE_MIN_LENGTH = 3;
export const SERVICE_TITLE_MAX_LENGTH = 120;
export const SERVICE_DESCRIPTION_MIN_LENGTH = 20;
export const SERVICE_DESCRIPTION_MAX_LENGTH = 5000;
export const SERVICE_CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const SERVICE_MIN_PRICE_VALUE = 0;
export const SERVICE_MAX_PRICE_VALUE = 1000000000;

// ISO-4217: mismas monedas que oportunidades.
export { CURRENCIES } from "@/opportunities/constants";

export function isAmountPricing(type: string | null | undefined): boolean {
  return type === "fixed" || type === "hourly";
}

export function isRangePricing(type: string | null | undefined): boolean {
  return type === "range";
}
