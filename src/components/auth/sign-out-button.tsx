"use client";

import { useAuthForm } from "@/components/auth/use-auth-form";
import { signOutAction } from "@/actions/auth";
import { initialAuthFormState } from "@/actions/auth-state";
import { Button } from "@/components/ui/button";

type Variant = "ghost" | "outline" | "default" | "secondary" | "destructive" | "link";
type Size = "default" | "sm" | "xs" | "lg" | "icon" | "icon-sm" | "icon-lg";

export function SignOutButton({
  children,
  variant = "ghost",
  size = "sm",
  className,
  title,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  title?: string;
  "aria-label"?: string;
}) {
  const { pending, handleSubmit } = useAuthForm(signOutAction, initialAuthFormState);

  return (
    <form onSubmit={handleSubmit} className="contents">
      <Button
        type="submit"
        variant={variant}
        size={size}
        className={className}
        title={title}
        aria-label={ariaLabel}
        disabled={pending}
      >
        {children}
      </Button>
    </form>
  );
}
