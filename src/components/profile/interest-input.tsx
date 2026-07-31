"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_INTERESTS } from "@/profiles/constants";

type InterestInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
};

export function InterestInput({ value, onChange }: InterestInputProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    if (value.length >= MAX_INTERESTS) {
      setError(`Puedes añadir como máximo ${MAX_INTERESTS} intereses.`);
      return;
    }
    if (value.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setError("Ese interés ya está añadido.");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
    setError(null);
  }

  function remove(interest: string) {
    onChange(value.filter((item) => item !== interest));
    setError(null);
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Escribe un interés y pulsa Enter"
          aria-label="Nuevo interés"
        />
        <Button type="button" variant="secondary" onClick={add} aria-label="Añadir interés">
          <Plus aria-hidden="true" />
          Añadir
        </Button>
      </div>

      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}

      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {value.map((interest) => (
            <li key={interest}>
              <Badge className="gap-1 border-border bg-muted px-3 py-1.5 text-sm">
                {interest}
                <button
                  type="button"
                  onClick={() => remove(interest)}
                  aria-label={`Quitar ${interest}`}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted-foreground/15 hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </Badge>
              <input type="hidden" name="intereses" value={interest} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
