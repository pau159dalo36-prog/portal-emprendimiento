import Image from "next/image"

import { cn } from "@/lib/utils"

export function initialsOf(name: string | null | undefined): string {
  const cleaned = (name ?? "").trim()
  if (!cleaned) {
    return "P"
  }
  const parts = cleaned.split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (first + second).toUpperCase() || "P"
}

type AvatarProps = {
  name: string | null | undefined
  src?: string | null
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials = initialsOf(name)

  if (src) {
    return (
      <Image
        src={src}
        alt={`Foto de ${name ?? "perfil"}`}
        width={96}
        height={96}
        className={cn(
          "shrink-0 rounded-full border border-border object-cover bg-muted",
          sizeClasses[size],
          className,
        )}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      data-slot="avatar"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full border border-border bg-primary/10 font-semibold text-primary",
        sizeClasses[size],
        className,
      )}
    >
      {initials}
    </div>
  )
}
