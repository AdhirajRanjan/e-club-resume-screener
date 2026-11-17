import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Compass, type LucideIcon } from "lucide-react";
import type { FormState } from "@/app/actions";

export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="brand">
    <span className="brand-mark" aria-hidden="true"><ArrowUpRight strokeWidth={2.6} size={23} /></span>
    <span>E-Club <span className="brand-secondary">Projects</span><small>Ashoka University</small></span>
  </Link>;
}

export function Back({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="back"><ArrowLeft size={16} />{children}</Link>;
}

export function Empty({ title, children, icon: Icon = Compass, action }: {
  title: string; children: React.ReactNode; icon?: LucideIcon; action?: React.ReactNode;
}) {
  return <div className="empty panel"><span className="icon-tile"><Icon size={23} /></span><h2>{title}</h2>
    <p>{children}</p>{action}</div>;
}

export function Notice({ state }: { state: FormState }) {
  if (state.error) return <div className="notice notice-error" role="alert">{state.error}</div>;
  if (state.success) return <div className="notice notice-success" role="status">{state.success}</div>;
  return null;
}

export function Skills({ items }: { items: string[] }) {
  return items.length ? <ul className="tags" aria-label="Skills">{items.map((skill, i) => <li key={`${skill}-${i}`}>{skill}</li>)}</ul> : null;
}
