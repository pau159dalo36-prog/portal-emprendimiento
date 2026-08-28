import type { ServiceRow } from "@/services/data";

// Estado del formulario de servicio (todos los valores como strings de
// formulario; los numéricos se convierten en la validación).
export type ServiceFormData = {
  title: string;
  description: string;
  category: string;
  delivery_mode: string;
  pricing_type: string;
  visibility: string;
  price_amount: string;
  price_min: string;
  price_max: string;
  currency: string;
};

export const emptyServiceFormData: ServiceFormData = {
  title: "",
  description: "",
  category: "otros",
  delivery_mode: "remote",
  pricing_type: "negotiable",
  visibility: "public",
  price_amount: "",
  price_min: "",
  price_max: "",
  currency: "",
};

// Prefill del formulario de edición desde la fila de la BD.
export function toServiceFormData(service: ServiceRow): ServiceFormData {
  return {
    title: service.title,
    description: service.description,
    category: service.category,
    delivery_mode: service.delivery_mode,
    pricing_type: service.pricing_type,
    visibility: service.visibility,
    price_amount:
      service.price_amount !== null && service.price_amount !== undefined
        ? String(service.price_amount)
        : "",
    price_min:
      service.price_min !== null && service.price_min !== undefined
        ? String(service.price_min)
        : "",
    price_max:
      service.price_max !== null && service.price_max !== undefined
        ? String(service.price_max)
        : "",
    currency: service.currency ?? "",
  };
}
