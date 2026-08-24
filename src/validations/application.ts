import { z } from "zod";

import { APPLICATION_MESSAGE_MAX_LENGTH } from "@/applications/config";
import type { ValidationTranslator } from "@/validations/auth";

function emptyToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

// MVP: mensaje opcional de motivación ("Me interesa porque…"). Sin CV ni
// campos extra: primera candidatura accesible sin fricción. El vacío⇒NULL lo
// re-aplica la BD (trigger), aquí solo se recorta y validan límites.
export function createApplicationSchema(t: ValidationTranslator) {
  return z.object({
    message: z.preprocess(
      emptyToNull,
      z
        .string()
        .trim()
        .max(APPLICATION_MESSAGE_MAX_LENGTH, { message: t("messageTooLong") })
        .nullable(),
    ),
  });
}

export type ApplicationInput = z.infer<ReturnType<typeof createApplicationSchema>>;
