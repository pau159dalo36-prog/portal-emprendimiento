import { z } from "zod";

import { MESSAGE_BODY_MAX_LENGTH } from "@/messaging/config";

/** Espejo de las invariantes SQL de messages: trim + longitud. El HTML no se
 * sanitiza aquí: el render nunca usa dangerouslySetInnerHTML, así que el body
 * es texto plano por construcción. */
export function createMessageSchema() {
  return z.object({
    body: z
      .string()
      .trim()
      .min(1, "EMPTY_BODY")
      .max(MESSAGE_BODY_MAX_LENGTH, "BODY_TOO_LONG"),
  });
}

export const targetProfileIdSchema = z.string().uuid("TARGET_NOT_FOUND");

export const conversationIdSchema = z.string().uuid("NOT_MEMBER");
