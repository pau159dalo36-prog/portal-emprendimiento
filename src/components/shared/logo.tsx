import { Link } from "@/i18n/navigation"

import { brand } from "@/config/brand"
import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        {brand.logoMark}
      </div>
      <span className="text-lg font-semibold tracking-tight">{brand.shortName}</span>
    </Link>
  )
}
