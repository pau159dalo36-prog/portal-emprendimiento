"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";

import { deleteVideoAction } from "@/actions/videos";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

export function VideoDeleteButton({ videoId }: { videoId: string }) {
  const t = useTranslations("videos");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!confirming) {
      return;
    }
    const timeout = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [confirming]);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    const formData = new FormData();
    formData.set("video_id", videoId);
    await deleteVideoAction(formData);
    setPending(false);
    setConfirming(false);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={confirming ? "destructive" : "ghost"}
      size="sm"
      disabled={pending}
      onClick={handleDelete}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 aria-hidden="true" />
      )}
      {confirming ? t("confirmDelete") : t("delete")}
    </Button>
  );
}
