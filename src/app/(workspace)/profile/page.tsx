import { ProfileForm } from "@/components/forms";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { profile } = await requireSession();
  return <>
    <header className="page-heading"><h1>Your profile</h1><p>Your campus details are used to identify your applications.</p></header>
    <section className="panel card measure"><ProfileForm profile={profile} /></section>
  </>;
}
