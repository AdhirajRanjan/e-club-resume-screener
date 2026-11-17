import { ArrowUpRight, BriefcaseBusiness } from "lucide-react";
import { redirect } from "next/navigation";
import { signInGoogle } from "@/app/actions";
import { MagicForm, SubmitButton } from "@/components/forms";
import { Brand } from "@/components/ui";
import { homeFor, session } from "@/lib/auth";
import { authorizedDomain, publicConfig } from "@/lib/config";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const existing = await session();
  if (existing) redirect(homeFor(existing.profile.role));
  const code = (await searchParams).error;
  const enabled = !!publicConfig();
  const google = enabled && process.env.GOOGLE_OAUTH_ENABLED === "true";
  return <main id="main-content" className="sign-in">
    <div className="sign-in-intro">
      <Brand />
      <div className="sign-decoration" aria-hidden="true"><ArrowUpRight strokeWidth={0.58} /></div>
      <div className="sign-copy">
        <span className="eyebrow"><BriefcaseBusiness size={16} aria-hidden="true" /> Entrepreneurship Club</span>
        <h1>Find your next<br />project.</h1>
        <p>Explore live E-Club projects, apply with your resume, and keep track of your applications.</p>
      </div>
    </div>
    <div className="sign-in-form">
      <div className="sign-form-inner">
        <span className="icon-tile"><ArrowUpRight size={24} aria-hidden="true" /></span>
        <h2>Sign in</h2>
        <p>Use your Ashoka University email to access the project portal.</p>
        {!enabled && <div className="notice" role="status">Sign-in is unavailable until the portal is connected to Supabase.</div>}
        {code && <div className="notice notice-error" role="alert">{code === "domain"
          ? `Sign in with your @${authorizedDomain()} account.`
          : "We couldn’t sign you in. Request a new link or try again."}</div>}
        {google && <><form action={signInGoogle}><SubmitButton secondary busy="Connecting…">Continue with Google</SubmitButton></form>
          <div className="divider"><span>or use email</span></div></>}
        <MagicForm domain={authorizedDomain()} enabled={enabled} />
        <small>First time here? A campus sign-in creates your account.</small>
      </div>
    </div>
  </main>;
}
