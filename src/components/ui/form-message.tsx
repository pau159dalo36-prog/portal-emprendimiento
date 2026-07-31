import { CircleAlert, CircleCheck, Info } from "lucide-react"

import { cn } from "@/lib/utils"

export type FormMessageProps = {
  status?: "success" | "error" | "info"
  children?: React.ReactNode
  className?: string
}

const icons = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
}

export function FormMessage({ status, children, className }: FormMessageProps) {
  if (!children) {
    return null
  }

  const Icon = icons[status ?? "info"]

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        status === "success" && "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400",
        status === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
        status !== "success" && status !== "error" && "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
