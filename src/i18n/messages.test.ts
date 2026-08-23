// Simetría de mensajes ES/EN: el árbol de claves de es.json y en.json debe ser
// idéntico (ni más ni menos). Evita traducciones que rompen en un idioma o
// claves huérfanas.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function loadMessages(): [Record<string, unknown>, Record<string, unknown>] {
  const dir = resolve(process.cwd(), "messages");
  return [
    JSON.parse(readFileSync(resolve(dir, "es.json"), "utf8")),
    JSON.parse(readFileSync(resolve(dir, "en.json"), "utf8")),
  ];
}

function collectKeys(value: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (child !== null && typeof child === "object" && !Array.isArray(child)) {
        for (const leaf of collectKeys(child, path)) {
          keys.add(leaf);
        }
      } else {
        keys.add(path);
      }
    }
  }
  return keys;
}

describe("mensajes i18n", () => {
  const [es, en] = loadMessages();

  it("es.json y en.json tienen el mismo árbol de claves", () => {
    const esKeys = collectKeys(es);
    const enKeys = collectKeys(en);

    const onlyEs = [...esKeys].filter((key) => !enKeys.has(key));
    const onlyEn = [...enKeys].filter((key) => !esKeys.has(key));

    expect({ onlyEs, onlyEn }).toEqual({ onlyEs: [], onlyEn: [] });
  });

  it("los nombres de los namespaces raíz coinciden", () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });
});
