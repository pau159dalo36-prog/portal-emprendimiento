"use client";

import { useEffect } from "react";

import { markConversationReadAction } from "@/actions/messaging";

/** Al montar el hilo, marca la conversación como leída (una sola vez). */
export function MarkThreadRead({ conversationId }: { conversationId: string }) {
  useEffect(() => {
    const formData = new FormData();
    formData.set("conversation_id", conversationId);
    void markConversationReadAction(formData);
  }, [conversationId]);

  return null;
}
