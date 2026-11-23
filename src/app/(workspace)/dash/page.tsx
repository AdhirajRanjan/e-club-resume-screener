import type { Metadata } from "next";
import { Dashboard } from "@/components/dash/dashboard";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Project matching" };
export const dynamic = "force-dynamic";

export default async function ProjectMatchingPage() {
  await requireSession("reviewer");
  return <Dashboard mode="live" />;
}
