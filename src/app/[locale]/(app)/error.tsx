"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("description")}</p>
      <Button onClick={() => unstable_retry()}>{t("retry")}</Button>
    </div>
  );
}
