"use client";

import { useEffect } from "react";
import type { ModalProps } from "@/types";

export default function Modal({ title, onClose, children }: ModalProps) {
  // Esc closes the dialog
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/60 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg bg-secondary p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="size-9 cursor-pointer rounded-md text-2xl hover:bg-neutral-100" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
