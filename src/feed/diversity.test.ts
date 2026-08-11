import { describe, expect, it } from "vitest";

import {
  DIVERSITY_MAX_CONSECUTIVE_AUTHOR,
  DIVERSITY_MAX_CONSECUTIVE_ORGANIZATION,
  DIVERSITY_MAX_CONSECUTIVE_PROJECT,
} from "@/feed/config";
import { applyDiversity, type DiversityItem, type DiversityLimits } from "@/feed/diversity";

function item(
  id: string,
  author: string,
  project: string,
  organization: string,
): DiversityItem & { id: string } {
  return { id, authorId: author, projectId: project, organizationId: organization };
}

describe("applyDiversity (reordena sin eliminar)", () => {
  it("no pierde candidatos: mismo conjunto de ids", () => {
    const items = [
      item("1", "a", "p1", "o1"),
      item("2", "a", "p2", "o1"),
      item("3", "a", "p3", "o1"),
      item("4", "b", "p4", "o1"),
    ];
    const result = applyDiversity(items);
    expect(result.map((i) => i.id).sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("es determinista: misma entrada → misma salida", () => {
    const items = [
      item("1", "a", "p1", "o1"),
      item("2", "a", "p2", "o1"),
      item("3", "a", "p3", "o1"),
      item("4", "b", "p4", "o2"),
    ];
    const first = applyDiversity(items);
    const second = applyDiversity(items);
    expect(second.map((i) => i.id)).toEqual(first.map((i) => i.id));
  });

  it("respeta máximo de autores consecutivos cuando hay candidatos alternativos", () => {
    const items = [
      item("1", "a", "p1", "o1"),
      item("2", "a", "p2", "o1"),
      item("3", "a", "p3", "o1"),
      item("4", "b", "p4", "o2"),
      item("5", "b", "p5", "o2"),
      item("6", "b", "p6", "o2"),
    ];
    const result = applyDiversity(items);
    let run = 0;
    let maxRun = 0;
    let prev: string | null | undefined;
    for (const entry of result) {
      if (entry.authorId === prev) {
        run += 1;
      } else {
        run = 1;
        prev = entry.authorId;
      }
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(DIVERSITY_MAX_CONSECUTIVE_AUTHOR);
  });

  it("cuando no hay alternativa, no elimina ni descarta (relaja la restricción)", () => {
    const allSameAuthor = [
      item("1", "a", "p1", "o1"),
      item("2", "a", "p2", "o1"),
      item("3", "a", "p3", "o1"),
      item("4", "a", "p4", "o1"),
      item("5", "a", "p5", "o1"),
    ];
    const result = applyDiversity(allSameAuthor);
    expect(result.map((i) => i.id)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("mismo autor → intercala con otros autores (nunca 3 seguidos)", () => {
    const items = [
      item("1", "a", "p1", "o1"),
      item("2", "a", "p2", "o1"),
      item("3", "a", "p3", "o1"),
      item("4", "b", "p4", "o2"),
      item("5", "b", "p5", "o2"),
      item("6", "b", "p6", "o2"),
    ];
    const result = applyDiversity(items);
    const authors = result.map((i) => i.authorId);
    // Se reordena de verdad (no quedan los 3 'a' juntos) respetando el límite.
    expect(authors).toEqual(["a", "a", "b", "a", "b", "b"]);
    expect(new Set(authors)).toEqual(new Set(["a", "b"]));
  });

  it("limites configurables: maxConsecutiveAuthor=1 fuerza alternancia estricta", () => {
    const items = [
      item("1", "a", "p1", "o1"),
      item("2", "a", "p2", "o1"),
      item("3", "b", "p3", "o2"),
      item("4", "b", "p4", "o2"),
    ];
    const limits: DiversityLimits = { maxConsecutiveAuthor: 1 };
    const result = applyDiversity(items, limits);
    expect(result.map((i) => i.authorId)).toEqual(["a", "b", "a", "b"]);
  });

  it("también limita proyectos consecutivos cuando hay alternativa", () => {
    const items = [
      item("1", "a", "p1", "o1"),
      item("2", "b", "p1", "o1"),
      item("3", "c", "p1", "o1"),
      item("4", "a", "p2", "o1"),
      item("5", "b", "p2", "o1"),
      item("6", "c", "p2", "o1"),
    ];
    const result = applyDiversity(items, { maxConsecutiveProject: 2 });
    let run = 0;
    let maxRun = 0;
    let prev: string | null | undefined;
    for (const entry of result) {
      if (entry.projectId === prev) {
        run += 1;
      } else {
        run = 1;
        prev = entry.projectId;
      }
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it("también limita organizaciones consecutivas cuando hay alternativa", () => {
    const items = [
      item("1", "a", "p1", "o1"),
      item("2", "b", "p1", "o1"),
      item("3", "c", "p1", "o1"),
      item("4", "a", "p2", "o2"),
      item("5", "b", "p2", "o2"),
      item("6", "c", "p2", "o2"),
    ];
    const result = applyDiversity(items, { maxConsecutiveOrganization: 2 });
    let run = 0;
    let maxRun = 0;
    let prev: string | null | undefined;
    for (const entry of result) {
      if (entry.organizationId === prev) {
        run += 1;
      } else {
        run = 1;
        prev = entry.organizationId;
      }
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it("los límites por defecto son 2 autor / 3 proyecto / 3 org", () => {
    expect(DIVERSITY_MAX_CONSECUTIVE_AUTHOR).toBe(2);
    expect(DIVERSITY_MAX_CONSECUTIVE_PROJECT).toBe(3);
    expect(DIVERSITY_MAX_CONSECUTIVE_ORGANIZATION).toBe(3);
  });

  it("arrays vacíos o de 1 elemento se devuelven tal cual", () => {
    expect(applyDiversity([])).toEqual([]);
    expect(applyDiversity([item("1", "a", "p1", "o1")]).map((i) => i.id)).toEqual(["1"]);
  });
});
