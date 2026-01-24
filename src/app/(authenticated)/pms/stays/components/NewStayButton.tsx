"use client";

import { Button } from "@/components/ui/button";

export function NewStayButton({ targetId = "create-stay" }: { targetId?: string }) {
  return (
    <Button
      variant="primary"
      type="button"
      onClick={() => {
        const el = document.getElementById(targetId);
        if (!el) return;

        el.scrollIntoView();

        if (el instanceof HTMLElement) {
          el.focus?.();
        }
      }}
    >
      New stay
    </Button>
  );
}
