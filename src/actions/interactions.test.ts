import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCommentAction,
  deleteCommentAction,
  hideCommentAction,
  toggleSaveAction,
  toggleSupportAction,
  updateCommentAction,
  upsertFeedbackAction,
} from "@/actions/interactions";

const ME = "00000000-0000-4000-8000-0000000000aa";
const POST_ID = "00000000-0000-4000-8000-000000000001";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const requireUserMock = vi.fn();
vi.mock("@/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

vi.mock("@/interactions/comments", () => ({
  createComment: vi.fn(async () => ({ id: "c1", error: null })),
  updateOwnComment: vi.fn(async () => ({ error: null })),
  setOwnCommentHidden: vi.fn(async () => ({ error: null })),
  deleteOwnComment: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/interactions/feedback", () => ({
  upsertProjectFeedback: vi.fn(async () => ({ id: "f1", error: null })),
}));

vi.mock("@/interactions/reactions", () => ({
  togglePostSupport: vi.fn(async () => ({ supported: true, error: null })),
}));

vi.mock("@/interactions/saves", () => ({
  toggleSave: vi.fn(async () => ({ saved: true, error: null })),
}));

import {
  createComment,
  deleteOwnComment,
  setOwnCommentHidden,
  updateOwnComment,
} from "@/interactions/comments";
import { upsertProjectFeedback } from "@/interactions/feedback";
import { togglePostSupport } from "@/interactions/reactions";
import { toggleSave } from "@/interactions/saves";

function formWith(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("acciones de interacciones", () => {
  beforeEach(() => {
    requireUserMock.mockResolvedValue({
      supabase: {} as never,
      user: { id: ME },
    });
    vi.mocked(togglePostSupport).mockClear();
    vi.mocked(toggleSave).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("anon no puede escribir: requireUser redirige y la acción falla", async () => {
    requireUserMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      createCommentAction(
        { status: "idle" },
        formWith({ post_id: POST_ID, body: "hola" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("createCommentAction publica un comentario válido", async () => {
    const state = await createCommentAction(
      { status: "idle" },
      formWith({ post_id: POST_ID, body: "Buen punto" }),
    );

    expect(state.status).toBe("success");
    expect(createComment).toHaveBeenCalledWith(expect.anything(), ME, {
      postId: POST_ID,
      parentId: null,
      body: "Buen punto",
    });
  });

  it("createCommentAction rechaza body vacío sin tocar la BD", async () => {
    const state = await createCommentAction(
      { status: "idle" },
      formWith({ post_id: POST_ID, body: "   " }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("invalidBody");
    expect(createComment).not.toHaveBeenCalled();
  });

  it("updateCommentAction edita lo propio", async () => {
    const commentId = "00000000-0000-4000-8000-000000000002";
    const state = await updateCommentAction(
      { status: "idle" },
      formWith({ comment_id: commentId, body: "mejorado" }),
    );

    expect(state.status).toBe("success");
    expect(updateOwnComment).toHaveBeenCalledWith(expect.anything(), ME, commentId, "mejorado");
  });

  it("hideCommentAction valida el id recibido", async () => {
    const state = await hideCommentAction(
      { status: "idle" },
      formWith({ comment_id: "no-uuid" }),
    );

    expect(state.status).toBe("error");
    expect(setOwnCommentHidden).not.toHaveBeenCalled();
  });

  it("deleteCommentAction borra lo propio", async () => {
    const commentId = "00000000-0000-4000-8000-000000000002";
    const state = await deleteCommentAction(
      { status: "idle" },
      formWith({ comment_id: commentId }),
    );

    expect(state.status).toBe("success");
    expect(deleteOwnComment).toHaveBeenCalledWith(expect.anything(), ME, commentId);
  });

  it("upsertFeedbackAction guarda feedback estructurado válido", async () => {
    const projectId = "00000000-0000-4000-8000-000000000003";
    const state = await upsertFeedbackAction(
      { status: "idle" },
      formWith({
        project_id: projectId,
        understanding: "Entiendo que valida ideas con vídeo.",
        would_use: "yes",
        interest_score: "9",
      }),
    );

    expect(state.status).toBe("success");
    expect(upsertProjectFeedback).toHaveBeenCalledWith(expect.anything(), ME, {
      projectId,
      understanding: "Entiendo que valida ideas con vídeo.",
      problem: null,
      useful: null,
      unclear: null,
      suggestions: null,
      wouldUse: "yes",
      interestScore: 9,
    });
  });

  it("upsertFeedbackAction rechaza interest_score fuera de rango", async () => {
    const state = await upsertFeedbackAction(
      { status: "idle" },
      formWith({
        project_id: "00000000-0000-4000-8000-000000000003",
        understanding: "Entiendo que valida ideas con vídeo.",
        would_use: "yes",
        interest_score: "11",
      }),
    );

    expect(state.status).toBe("error");
    expect(upsertProjectFeedback).not.toHaveBeenCalled();
  });

  it("toggleSupportAction propaga NOT_ALLOWED como mensaje traducido", async () => {
    vi.mocked(togglePostSupport).mockResolvedValueOnce({
      supported: null,
      error: "NOT_ALLOWED",
    });

    const state = await toggleSupportAction(
      { status: "idle" },
      formWith({ post_id: POST_ID }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("notAllowed");
  });

  it("toggleSaveAction devuelve el nuevo estado de guardado", async () => {
    vi.mocked(toggleSave).mockResolvedValueOnce({ saved: true, error: null });

    const state = await toggleSaveAction(
      { status: "idle" },
      formWith({ target_type: "post", target_id: POST_ID }),
    );

    expect(state).toMatchObject({ status: "success", saved: true });
    expect(toggleSave).toHaveBeenCalledWith(expect.anything(), ME, "post", POST_ID);
  });

  it("toggleSaveAction acepta servicios como destino (FASE 7)", async () => {
    const SERVICE_ID = "00000000-0000-4000-8000-0000000000c1";
    vi.mocked(toggleSave).mockResolvedValueOnce({ saved: false, error: null });

    const state = await toggleSaveAction(
      { status: "idle" },
      formWith({ target_type: "service", target_id: SERVICE_ID }),
    );

    expect(state).toMatchObject({ status: "success", saved: false });
    expect(toggleSave).toHaveBeenCalledWith(expect.anything(), ME, "service", SERVICE_ID);
  });

  it("toggleSaveAction rechaza tipos de destino desconocidos", async () => {
    const state = await toggleSaveAction(
      { status: "idle" },
      formWith({ target_type: "organization", target_id: POST_ID }),
    );

    expect(state.status).toBe("error");
    expect(toggleSave).not.toHaveBeenCalled();
  });
});
