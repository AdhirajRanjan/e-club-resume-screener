import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Info } from "lucide-react";
import { Skills } from "@/components/ui";
import { sampleProjects } from "./examples";

export const metadata = { title: "Read-only demo" };

export default function DemoHome() {
  return <>
    <section className="hero">
      <div className="hero-art" aria-hidden="true"><ArrowUpRight strokeWidth={0.45} /></div>
      <div className="hero-content">
        <span className="eyebrow"><BriefcaseBusiness size={16} aria-hidden="true" /> Entrepreneurship Club</span>
        <h1>Explore projects</h1>
        <p>Browse synthetic project examples and see how a reviewer would read a shortlist.</p>
      </div>
    </section>
    <div className="notice demo-notice"><Info size={17} aria-hidden="true" />
      <span>All projects and applicants shown here are fictional. Sign-in, submissions, screening, decisions, and CSV export are unavailable in this demo.</span>
    </div>
    <div className="section-heading"><h2>Example projects</h2></div>
    <div className="project-grid">{sampleProjects.map((project) => <article key={project.slug} className="panel project-card">
      <span className="icon-tile"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
      <h3>{project.name}</h3>
      <p>{project.shortDescription}</p>
      <Skills items={project.skills} />
      <div className="project-foot"><span>Example project</span>
        <Link href={`/demo/projects/${project.slug}`} aria-label={`View ${project.name}`}>View project <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
    </article>)}</div>
  </>;
}
