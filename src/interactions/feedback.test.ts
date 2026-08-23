import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getMyProjectFeedback, getProjectFeedbackCount, upsertProjectFeedback } from "@/interactions/feedback";
import {
  feedbackInterestScoreSchema,
  projectFeedbackSchema,
} from "@/validations/interactions";
import type { Database } from "@/types/database.types";

function createQuerySpy(options: { data?: unknown; error?: unknown } = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const result = { data: options.data, error: options.error ?? null };

  function makeBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "insert", "update", "delete", "upsert"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      calls.push({ method: "maybeSingle", args: [] });
      return builder;
    };
    builder.single = () => {
      calls.push({ method: "single", args: [] });
      return builder;
    };
    builder.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      if (options.error) {
        return Promise.resolve(onRejected?.(options.error));
      }
      return Promise.resolve(onFulfilled(result));
    };
    return builder;
  }

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return makeBuilder();
    },
    rpc(...args: unknown[]) {
      calls.push({ method: "rpc", args });
      return makeBuilder();
    },
  };

  return { supabase: supabase as unknown as SupabaseClient<Database>, calls };
}

const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const ME = "00000000-0000-4000-8000-0000000000aa";

const VALID_INPUT = {
  projectId: PROJECT_ID,
  understanding: "Es una plataforma para validar ideas de negocio.",
  problem: "Falta feedback estructurado",
  useful: null,
  unclear: null,
  suggestions: null,
  wouldUse: "maybe" as const,
  interestScore: null,
};

describe("feedback (capa de datos)", () => {
  it("upsert usa el UNIQUE (project_id, author_id): crear y actualizar es la misma operación", async () => {
    const { supabase, calls } = createQuerySpy({ data: { id: "f1" } });
    const result = await upsertProjectFeedback(supabase, ME, VALID_INPUT);

    expect(result.error).toBeNull();
    const upsert = calls.find((call) => call.method === "upsert");
    expect(upsert?.args[1]).toEqual({ onConflict: "project_id, author_id" });
    // Sin ignoreDuplicates: si ya existe, se ACTUALIZA (no se ignora).
    expect(upsert?.args[1]).not.toHaveProperty("ignoreDuplicates");
  });

  it("upsert normaliza strings vacíos a null", async () => {
    const { supabase, calls } = createQuerySpy({ data: { id: "f1" } });
    await upsertProjectFeedback(supabase, ME, {
      ...VALID_INPUT,
      problem: "   ",
      suggestions: "",
    });

    const upsert = calls.find((call) => call.method === "upsert");
    expect(upsert?.args[0]).toMatchObject({ problem: null, suggestions: null });
  });

  it("getMyProjectFeedback filtra por proyecto y autor propio", async () => {
    const { supabase, calls } = createQuerySpy({ data: null });
    await getMyProjectFeedback(supabase, PROJECT_ID, ME);

    const eqs = calls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toContainEqual(["project_id", PROJECT_ID]);
    expect(eqs).toContainEqual(["author_id", ME]);
    expect(calls.some((call) => call.method === "maybeSingle")).toBe(true);
  });

  it("getProjectFeedbackCount usa la RPC agregada", async () => {
    const { supabase, calls } = createQuerySpy({ data: 7 });
    const count = await getProjectFeedbackCount(supabase, PROJECT_ID);

    expect(count).toBe(7);
    expect(
      calls.find((call) => call.method === "rpc")?.args,
    ).toEqual(["get_project_feedback_count", { p_project_id: PROJECT_ID }]);
  });

  it("getProjectFeedbackCount devuelve 0 si la RPC no responde número", async () => {
    const { supabase } = createQuerySpy({ data: undefined });
    expect(await getProjectFeedbackCount(supabase, PROJECT_ID)).toBe(0);
  });

  it("esquema: feedback completo válido parsea", () => {
    const parsed = projectFeedbackSchema.safeParse({
      projectId: PROJECT_ID,
      understanding: "Entiendo que valida ideas con vídeo.",
      problem: "x",
      useful: "",
      unclear: null,
      suggestions: "Añadir métricas",
      wouldUse: "yes",
      interestScore: "8",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.interestScore).toBe(8);
      expect(parsed.data.useful).toBeNull();
    }
  });

  it("interestScore: 0–10 válidos, vacío→null, decimales y fuera de rango inválidos", () => {
    expect(feedbackInterestScoreSchema.safeParse("").success).toBe(true);
    expect(feedbackInterestScoreSchema.safeParse(null).success).toBe(true);
    expect(feedbackInterestScoreSchema.safeParse("0").success).toBe(true);
    expect(feedbackInterestScoreSchema.safeParse("10").success).toBe(true);
    expect(feedbackInterestScoreSchema.safeParse("11").success).toBe(false);
    expect(feedbackInterestScoreSchema.safeParse("-1").success).toBe(false);
    expect(feedbackInterestScoreSchema.safeParse("7.5").success).toBe(false);
  });

  it("understanding exige mínimo de longitud del CHECK SQL", () => {
    expect(projectFeedbackSchema.safeParse({
      ...VALID_INPUT,
      understanding: "corto",
    }).success).toBe(false);
    expect(projectFeedbackSchema.safeParse({
      ...VALID_INPUT,
      understanding: "Texto suficientemente largo.",
    }).success).toBe(true);
  });
});
