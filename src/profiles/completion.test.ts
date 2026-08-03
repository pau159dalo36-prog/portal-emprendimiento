import { describe, expect, test } from "vitest";
import { getCompletionPercent } from "@/profiles/completion";

describe("getCompletionPercent", () => {
  test("devuelve 0 cuando ninguna sección está completada", () => {
    const sections = [
      { key: "a", label: "A", done: false },
      { key: "b", label: "B", done: false },
    ];
    expect(getCompletionPercent(sections)).toBe(0);
  });

  test("devuelve 100 cuando todas están completadas", () => {
    const sections = [
      { key: "a", label: "A", done: true },
      { key: "b", label: "B", done: true },
    ];
    expect(getCompletionPercent(sections)).toBe(100);
  });

  test("redondea porcentajes parciales", () => {
    const sections = [
      { key: "a", label: "A", done: true },
      { key: "b", label: "B", done: true },
      { key: "c", label: "C", done: false },
    ];
    expect(getCompletionPercent(sections)).toBe(67);
  });

  test("devuelve 0 para una lista vacía", () => {
    expect(getCompletionPercent([])).toBe(0);
  });
});
