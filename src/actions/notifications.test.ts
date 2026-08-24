import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";

const ME = "00000000-0000-4000-8000-0000000000aa";
const NOTIFICATION_ID = "00000000-0000-4000-8000-000000000001";

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

vi.mock("@/notifications/data", () => ({
  markNotificationRead: vi.fn(async () => true),
  markAllNotificationsRead: vi.fn(async () => true),
}));

import { revalidatePath } from "next/cache";
import { markAllNotificationsRead, markNotificationRead } from "@/notifications/data";

function formWith(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("acciones de notificaciones", () => {
  beforeEach(() => {
    requireUserMock.mockResolvedValue({
      supabase: {} as never,
      user: { id: ME },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("anon no puede marcar: requireUser redirige", async () => {
    requireUserMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      markNotificationReadAction(formWith({ notification_id: NOTIFICATION_ID })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("marca una notificación propia como leída con actor de sesión", async () => {
    await markNotificationReadAction(formWith({ notification_id: NOTIFICATION_ID }));

    expect(markNotificationRead).toHaveBeenCalledWith(
      expect.anything(),
      ME,
      NOTIFICATION_ID,
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("ignora ids no válidos sin tocar la BD", async () => {
    await markNotificationReadAction(formWith({ notification_id: "no-uuid" }));

    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("markAllNotificationsReadAction marca todas las propias en una pasada", async () => {
    await markAllNotificationsReadAction();

    expect(markAllNotificationsRead).toHaveBeenCalledWith(expect.anything(), ME);
    expect(revalidatePath).toHaveBeenCalled();
  });
});
