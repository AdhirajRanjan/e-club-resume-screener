import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return <div className="panel empty" role="status"><LoaderCircle className="spin" size={24} /> Loading…</div>;
}
