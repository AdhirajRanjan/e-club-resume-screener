import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { Back, Skills } from "@/components/ui";
import { sampleProjects } from "../../examples";

export default async function DemoProject({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = sampleProjects.find((item) => item.slug === slug);
  if (!project) notFound();

  return <>
    <Back href="/demo">Example projects</Back>
    <header className="page-heading">
      <span className="pill">Synthetic project</span>
      <h1>{project.name}</h1>
      <p>{project.shortDescription}</p>
    </header>
    <div className="detail-grid">
      <article className="panel card form-stack">
        <section><h2>About the project</h2><p className="prose-text">{project.description}</p></section>
        <section><h2>Required skills</h2><Skills items={project.skills} /></section>
        <section><h2>Eligibility</h2><p className="prose-text">{project.requirements}</p></section>
      </article>
      <aside className="panel card deadline-card">
        <h2><FileText size={19} aria-hidden="true" /> Applications unavailable</h2>
        <p>Resume uploads and application submissions require the live backend.</p>
      </aside>
    </div>
  </>;
}
