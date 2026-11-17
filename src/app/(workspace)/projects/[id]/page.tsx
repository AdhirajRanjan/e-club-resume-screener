import Link from "next/link";
import { CalendarDays, FileText } from "lucide-react";
import { ApplicationForm } from "@/components/application-form";
import { Back, Skills } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { resumeLimitBytes } from "@/lib/config";
import { getProject, isOpen } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Project details" };

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { db, profile } = await requireSession("applicant");
  const project = await getProject(db, (await params).id);
  const { data: previous, error } = await db.from("applications").select("answers,links,submission_version")
    .eq("project_id", project.id).eq("user_id", profile.id).maybeSingle();
  if (error) throw new Error("application_lookup_failed");
  const open = isOpen(project);
  return <>
    <Back href="/projects">Explore projects</Back>
    <header className="page-heading">
      <span className={open ? "pill pill-open" : "pill"}>{open && <span />}{open ? "Applications open" : "Applications closed"}</span>
      <h1>{project.name}</h1><p>{project.short_description}</p>
    </header>
    <div className="detail-grid">
      <article className="panel card form-stack">
        <section><h2>About the project</h2><p className="prose-text">{project.description}</p></section>
        <section><h2>Required skills</h2><Skills items={project.required_skills} /></section>
        {project.requirements && <section><h2>Eligibility</h2><p className="prose-text">{project.requirements}</p></section>}
      </article>
      <aside className="panel card deadline-card"><h2><CalendarDays size={19} aria-hidden="true" /> Application deadline</h2>
        <p><time dateTime={project.deadline}>{formatDateTime(project.deadline)}</time></p>
        {open && <a className="button" href="#application">Apply to this project</a>}</aside>
    </div>
    <section id="application" className="panel card measure application-panel">
      <div className="section-heading"><h2><FileText size={21} aria-hidden="true" /> {previous && open ? "Replace your application" : "Application"}</h2></div>
      {!open ? <p>Submissions for this project are closed.</p>
        : !profile.name || !profile.student_id ? <><p>Save your name and student ID before submitting.</p>
          <Link className="button button-secondary" href="/profile">Complete your profile</Link></>
        : <>{previous && <p>Your most recent submission is the version the reviewer will see.</p>}
          <ApplicationForm projectId={project.id} previous={previous} questions={project.questions} maxBytes={resumeLimitBytes()} /></>}
    </section>
  </>;
}
