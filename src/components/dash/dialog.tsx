"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function DashDialog({ children, className = "", labelledBy, onClose }: {
  children: ReactNode;
  className?: string;
  labelledBy: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    function closeOnEscape(event: Event) {
      event.preventDefault();
      closeRef.current();
    }
    dialog.addEventListener("cancel", closeOnEscape);
    return () => {
      dialog.removeEventListener("cancel", closeOnEscape);
      if (dialog.open) dialog.close();
    };
  }, []);

  return <dialog ref={dialogRef} className={`dash-dialog ${className}`} aria-labelledby={labelledBy}
    onClick={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}>
    {children}
  </dialog>;
}
