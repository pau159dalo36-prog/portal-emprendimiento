"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

type VideoUploadDropzoneProps = {
  onFile: (file: File) => void;
  accept: string;
  maxBytes: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
};

export function VideoUploadDropzone({
  onFile,
  accept,
  maxBytes,
  multiple = false,
  disabled = false,
  className,
}: VideoUploadDropzoneProps) {
  const t = useTranslations("videoForm");
  const tv = useTranslations("videoValidation");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || disabled) {
      return;
    }
    for (const file of Array.from(files)) {
      if (file.size > maxBytes) {
        setErrorKey("tooLarge");
        return;
      }
    }
    setErrorKey(null);
    for (const file of Array.from(files)) {
      onFile(file);
      if (!multiple) {
        break;
      }
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <UploadCloud className="size-8 text-muted-foreground" aria-hidden="true" />
      <div className="grid gap-1">
        <p className="text-sm font-medium">{t("dropzoneTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("dropzoneHint")}</p>
      </div>
      {errorKey && <p className="text-sm text-destructive">{tv(errorKey)}</p>}
    </div>
  );
}
