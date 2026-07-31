"use client";

import { cn } from "@/lib/utils";
import { SKILL_LEVELS, SKILL_LEVEL_LABELS } from "@/profiles/constants";
import type { SkillOption, SkillSelection } from "@/profiles/map";

export type { SkillOption, SkillSelection };

type SkillSelectorProps = {
  skills: SkillOption[];
  value: SkillSelection;
  onChange: (next: SkillSelection) => void;
};

export function SkillSelector({ skills, value, onChange }: SkillSelectorProps) {
  function toggle(skillId: string) {
    const next: SkillSelection = { ...value };
    if (skillId in next) {
      delete next[skillId];
    } else {
      next[skillId] = null;
    }
    onChange(next);
  }

  function setLevel(skillId: string, level: number | null) {
    onChange({ ...value, [skillId]: level });
  }

  return (
    <div className="grid gap-2">
      {skills.map((skill) => {
        const selected = skill.id in value;
        return (
          <div
            key={skill.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors",
              selected ? "border-primary/40 bg-primary/5" : "border-border bg-background",
            )}
          >
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="habilidades"
                value={skill.id}
                checked={selected}
                onChange={() => toggle(skill.id)}
                className="size-4 rounded border-border accent-primary"
              />
              <span className="text-sm font-medium">{skill.name}</span>
            </label>

            {selected && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`nivel-${skill.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Nivel
                </label>
                <select
                  id={`nivel-${skill.id}`}
                  value={value[skill.id] ?? ""}
                  onChange={(event) => {
                    const next = event.target.value === "" ? null : Number(event.target.value);
                    setLevel(skill.id, next);
                  }}
                  aria-label={`Nivel de ${skill.name}`}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <option value="">Opcional</option>
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {SKILL_LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
                {value[skill.id] != null && (
                  <input
                    type="hidden"
                    name="niveles"
                    value={`${skill.id}:${value[skill.id]}`}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
