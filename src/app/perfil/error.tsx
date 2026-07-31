"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Hubo un problema al cargar esta página. Puedes intentarlo de nuevo.
      </p>
      <Button onClick={() => unstable_retry()}>Intentar de nuevo</Button>
    </div>
  );
}
