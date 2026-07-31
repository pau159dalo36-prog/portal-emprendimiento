"use client";

import { cn } from "@/lib/utils";

export type ChipGroupOption = {
  value: string;
  label: string;
};

type ChipGroupProps = {
  name: string;
  options: ChipGroupOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

export function ChipGroup({ name, options, value, onChange, disabled }: ChipGroupProps) {
  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <label
            key={option.value}
            className={cn(
              "inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors select-none focus-within:ring-3 focus-within:ring-ring/30",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => toggle(option.value)}
              disabled={disabled}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
