import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  markConversationReadAction,
  sendMessageAction,
  startConversationAction,
} from "@/actions/messaging";
import { SEND_RATE_LIMIT_PER_MINUTE } from "@/messaging/config";

const ME = "00000000-0000-4000-8000-0000000000aa";
const OTHER = "00000000-0000-4000-8000-0000000000bb";
const CONVERSATION = "00000000-0000-4000-8000-000000000001";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
  getLocale: async () => "es",
}));

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  getPathname: ({ href }: { href: string }) => href,
}));

const requireUserMock = vi.fn();
vi.mock("@/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

vi.mock("@/messaging/data", () => ({
  getOrCreateDm: vi.fn(async () => ({
    conversationId: CONVERSATION,
    error: null,
  })),
  sendMessage: vi.fn(async () => ({
    message: { id: "m1" },
    error: null,
  })),
  markConversationRead: vi.fn(async () => true),
}));

import { revalidatePath } from "next/cache";
import {
  getOrCreateDm,
  markConversationRead,
  sendMessage,
} from "@/messaging/data";

function formWith(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

/** Stub del cliente para el contador anti-flood de la acción. */
function floodStub(count: number) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    then: (res: (v: unknown) => unknown) => Promise.resolve(res({ count })),
  };
  return { from: () => builder };
}

describe("acciones de mensajería", () => {
  beforeEach(() => {
    requireUserMock.mockResolvedValue({
      supabase: floodStub(0) as never,
      user: { id: ME },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("anon no puede iniciar conversación: requireUser redirige", async () => {
    requireUserMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      startConversationAction({ status: "idle" }, formWith({ target_profile_id: OTHER })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(getOrCreateDm).not.toHaveBeenCalled();
  });

  it("startConversationAction abre la DM y navega al hilo /mensajes/{id}", async () => {
    await expect(
      startConversationAction({ status: "idle" }, formWith({ target_profile_id: OTHER })),
    ).rejects.toThrow(`NEXT_REDIRECT:/mensajes/${CONVERSATION}`);

    expect(getOrCreateDm).toHaveBeenCalledWith(expect.anything(), OTHER);
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("startConversationAction rechaza target no-UUID sin tocar la BD", async () => {
    const state = await startConversationAction(
      { status: "idle" },
      formWith({ target_profile_id: "no-uuid" }),
    );

    expect(state.status).toBe("error");
    expect(getOrCreateDm).not.toHaveBeenCalled();
  });

  it("startConversationAction traduce BLOCKED a mensaje de UI", async () => {
    vi.mocked(getOrCreateDm).mockResolvedValueOnce({
      conversationId: null,
      error: "BLOCKED",
    });

    const state = await startConversationAction(
      { status: "idle" },
      formWith({ target_profile_id: OTHER }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("errorBlocked");
  });

  it("sendMessageAction envía un mensaje válido y marca el hilo leído", async () => {
    const state = await sendMessageAction(
      { status: "idle" },
      formWith({ conversation_id: CONVERSATION, body: "  hola  " }),
    );

    expect(state.status).toBe("success");
    expect(sendMessage).toHaveBeenCalledWith(
      expect.anything(),
      CONVERSATION,
      ME,
      "hola",
    );
    expect(markConversationRead).toHaveBeenCalledWith(expect.anything(), ME, CONVERSATION);
    expect(revalidatePath).toHaveBeenCalledWith(`/mensajes/${CONVERSATION}`);
  });

  it("sendMessageAction rechaza cuerpo vacío antes del rate-limit y la BD", async () => {
    const state = await sendMessageAction(
      { status: "idle" },
      formWith({ conversation_id: CONVERSATION, body: "   " }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("errorEmpty");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sendMessageAction responde FLOOD al superar el límite por minuto", async () => {
    requireUserMock.mockResolvedValue({
      supabase: floodStub(SEND_RATE_LIMIT_PER_MINUTE) as never,
      user: { id: ME },
    });

    const state = await sendMessageAction(
      { status: "idle" },
      formWith({ conversation_id: CONVERSATION, body: "hola" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("errorFlood");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sendMessageAction traduce BLOCKED del insert a mensaje de UI", async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      message: null,
      error: "BLOCKED",
    });

    const state = await sendMessageAction(
      { status: "idle" },
      formWith({ conversation_id: CONVERSATION, body: "hola" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("errorBlocked");
  });

  it("markConversationReadAction ignora ids inválidos y marca lo propio", async () => {
    await markConversationReadAction(formWith({ conversation_id: "nope" }));
    expect(markConversationRead).not.toHaveBeenCalled();

    await markConversationReadAction(formWith({ conversation_id: CONVERSATION }));
    expect(markConversationRead).toHaveBeenCalledWith(expect.anything(), ME, CONVERSATION);
  });
});
