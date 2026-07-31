"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { removeAvatarAction, updateAvatarAction } from "@/actions/avatar";
import type { FormState } from "@/actions/form-state";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { compressAvatar, validateAvatarFile } from "@/components/profile/avatar-utils";

type AvatarUploaderProps = {
  name: string | null | undefined;
  src?: string | null;
};

export function AvatarUploader({ name, src }: AvatarUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  async function handleFile(file: File | null) {
    if (!file) {
      return;
    }
    const clientError = validateAvatarFile(file);
    if (clientError) {
      setState({ status: "error", message: clientError });
      return;
    }

    setBusy("upload");
    setState({ status: "idle" });
    try {
      const compressed = await compressAvatar(file);
      const formData = new FormData();
      formData.append("avatar", compressed);
      const result = await updateAvatarAction(formData);
      setState(result);
      if (result.status === "success") {
        router.refresh();
      }
    } finally {
      setBusy(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleRemove() {
    setBusy("remove");
    setState({ status: "idle" });
    try {
      const result = await removeAvatarAction();
      setState(result);
      if (result.status === "success") {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} src={src} size="xl" />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            className="hidden"
            aria-label="Seleccionar imagen de perfil"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            {busy === "upload" ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Camera aria-hidden="true" />
            )}
            {busy === "upload" ? "Subiendo…" : "Subir foto"}
          </Button>
          {src && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={handleRemove}
            >
              {busy === "remove" ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Quitar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, WebP, GIF o AVIF. Máximo 5 MB y 512 px (se comprime automáticamente).
        </p>
      </div>

      <div className="w-full">
        <FormMessage
          status={state.status === "idle" ? undefined : state.status}
          className={state.status === "idle" ? "hidden" : undefined}
        >
          {state.status === "idle" ? undefined : state.message}
        </FormMessage>
      </div>
    </div>
  );
}
