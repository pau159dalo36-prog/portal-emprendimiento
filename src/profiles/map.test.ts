import { describe, expect, test } from "vitest";
import { toSkillSelection } from "@/profiles/map";

describe("toSkillSelection", () => {
  test("convierte una lista de habilidades a un mapa skill_id -> level", () => {
    const skills = [
      { skill_id: "s1", level: 3 },
      { skill_id: "s2", level: null },
    ];
    expect(toSkillSelection(skills)).toEqual({ s1: 3, s2: null });
  });

  test("devuelve un objeto vacío sin habilidades", () => {
    expect(toSkillSelection([])).toEqual({});
  });
});
