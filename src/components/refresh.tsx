"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function Refresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className="button button-quiet" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
    <RefreshCw size={16} className={pending ? "spin" : undefined} aria-hidden="true" /> {pending ? "Refreshing…" : "Refresh"}
  </button>;
}
