import { redirect } from "next/navigation";
import { homeFor, session } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const current = await session();
  redirect(current ? homeFor(current.profile.role) : "/sign-in");
}
