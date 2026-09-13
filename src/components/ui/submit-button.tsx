"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingText?: string
}

export function SubmitButton({ pendingText, children, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={disabled || pending} aria-busy={pending} {...props}>
      {pending ? (pendingText ?? children) : children}
    </Button>
  )
}
