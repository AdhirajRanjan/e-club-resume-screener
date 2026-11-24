import Link from "next/link";
import { Eye } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Dashboard } from "@/components/dash/dashboard";
import { Brand } from "@/components/ui";

export const metadata: Metadata = { title: "Project matching prototype" };

export default function ProjectMatchingPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <div className="workspace dash-preview-page">
    <header className="topbar"><div className="topbar-inner">
      <Brand href="/" />
      <span className="pill"><Eye size={14} aria-hidden="true" /> Fictional-data preview</span>
      <Link href="/sign-in" className="button button-secondary">Sign in</Link>
    </div></header>
    <main id="main-content" className="container"><Dashboard mode="preview" /></main>
    <footer className="footer"><span>Entrepreneurship Club</span><span>Prototype · all records are synthetic</span></footer>
  </div>;
}
