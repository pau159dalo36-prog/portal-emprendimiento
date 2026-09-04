"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingText?: string
  /** pending explícito gestionado por el formulario que llama a la Server Action de forma manual. */
  isPending?: boolean
}

export function SubmitButton({ pendingText, children, disabled, isPending, ...props }: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus()
  const pending = isPending ?? formPending

  return (
    <Button type="submit" disabled={disabled || pending} aria-busy={pending} {...props}>
      {pending ? (pendingText ?? children) : children}
    </Button>
  )
}
