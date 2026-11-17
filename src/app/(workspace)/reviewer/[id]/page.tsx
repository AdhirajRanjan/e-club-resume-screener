import Link from "next/link";
import { ArrowUpRight, CalendarDays, Download, ListFilter, Pencil, Search, UsersRound } from "lucide-react";
import { Back, Empty } from "@/components/ui";
import { Refresh } from "@/components/refresh";
import { requireSession } from "@/lib/auth";
import { deadlinePassed, getProject, isOpen } from "@/lib/data";
import { decisionLabel, formatDateTime, screeningState } from "@/lib/format";
import { buckets, decisions, type Bucket, type Decision } from "@/lib/schema";

export const metadata = { title: "Project review" };

type Rank = {
  id: string; name: string; email: string; score: number | null; bucket: Bucket | null;
  matched_skills: string[] | null; flags: string[] | null; decision: Decision | null;
  job_status: string; error_code: string | null;
};

export default async function ProjectReview({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; bucket?: string; decision?: string; page?: string }>;
}) {
  const { db, profile } = await requireSession("reviewer");
  const project = await getProject(db, (await params).id, profile.id);
  const controls = await searchParams;
  const query = (typeof controls.q === "string" ? controls.q : "").trim().slice(0, 100);
  const bucket = [...buckets, "unscreened"].find((item) => item === controls.bucket);
  const decision = [...decisions, "pending"].find((item) => item === controls.decision);
  const requestedPage = Number(controls.page);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(10000, requestedPage)) : 1;
  const size = 30;
  let request = db.from("ranked_applications")
    .select("id,name,email,score,bucket,matched_skills,flags,decision,job_status,error_code", { count: "exact" })
    .eq("project_id", project.id);
  if (query) request = request.ilike("search_text", `%${query.replace(/[\\%_*]/g, "\\$&")}%`);
  if (bucket) request = bucket === "unscreened" ? request.is("bucket", null) : request.eq("bucket", bucket);
  if (decision) request = decision === "pending" ? request.is("decision", null) : request.eq("decision", decision);
  const { data, error, count } = await request.order("bucket_order").order("score", { ascending: false, nullsFirst: false })
    .order("submitted_at").order("id").range((page - 1) * size, page * size - 1);
  if (error && error.code !== "PGRST103") throw new Error("ranking_load_failed");
  const rows = (data || []) as Rank[];
  const groups = [...buckets, "Unscreened"].map((label) => ({ label, items: rows.filter((row) => (row.bucket || "Unscreened") === label) }));
  const href = `/reviewer/${project.id}`;
  const exportReady = deadlinePassed(project.deadline);
  const pageHref = (next: number) => {
    const filters = new URLSearchParams({ page: String(next) });
    if (query) filters.set("q", query);
    if (bucket) filters.set("bucket", bucket);
    if (decision) filters.set("decision", decision);
    return `${href}?${filters.toString()}`;
  };

  return <>
    <Back href="/reviewer">Your projects</Back>
    <header className="page-heading page-heading-actions"><div>
      <span className={isOpen(project) ? "pill pill-open" : "pill"}>{isOpen(project) ? "Applications open" : project.status === "draft" ? "Draft" : "Applications closed"}</span>
      <h1>{project.name}</h1><p>{project.short_description}</p>
      <div className="metadata"><CalendarDays size={16} aria-hidden="true" /> Deadline {formatDateTime(project.deadline)} <span>·</span> Rubric v{project.rubric_version}</div>
    </div><div className="row wrap header-actions">
      <Link className="button button-secondary" href={`${href}/edit`}><Pencil size={16} aria-hidden="true" /> Edit project</Link>
      {exportReady && <a className="button" href={`${href}/export`}><Download size={16} aria-hidden="true" /> Export shortlist</a>}
    </div></header>
    {!exportReady && <p className="muted export-note">Shortlist export opens after the application deadline.</p>}
    <div className="section-heading"><div><h2>Applications</h2><span>AI screening is advisory. Review the resume and record your own decision.</span></div><Refresh /></div>
    <form className="panel filters" action={href}>
      <label><Search size={16} aria-hidden="true" /> Search applicants<input name="q" defaultValue={query} maxLength={100} placeholder="Name or email" /></label>
      <label>AI bucket<select name="bucket" defaultValue={bucket || ""}><option value="">All buckets</option>
        {buckets.map((item) => <option key={item}>{item}</option>)}<option value="unscreened">Unscreened</option>
      </select></label>
      <label>Reviewer decision<select name="decision" defaultValue={decision || ""}><option value="">All decisions</option>
        {[...decisions, "pending"].map((item) => <option key={item} value={item}>{decisionLabel(item)}</option>)}
      </select></label>
      <button className="button button-secondary" type="submit"><ListFilter size={16} aria-hidden="true" /> Filter</button>
      {(query || bucket || decision) && <Link className="button button-quiet" href={href}>Clear</Link>}
    </form>
    {!rows.length ? <Empty icon={UsersRound} title={query || bucket || decision ? "No matching applications" : "No applications here yet"}>
      {query || bucket || decision ? "Try a different search or clear the filters." : "Applications will appear here once students submit them."}</Empty>
      : <>
        <p className="result-count">{count ?? rows.length} {(count ?? rows.length) === 1 ? "application" : "applications"}</p>
        {groups.filter((group) => group.items.length).map(({ label, items }) => <section className="rank-group" key={label}>
          <h3><span className={`pill bucket-${label.toLowerCase()}`}>{label}</span></h3>
          <div className="panel table-scroll"><table><caption className="sr-only">{label} applications</caption>
            <thead><tr><th>Applicant</th><th>Score</th><th>Matched criteria</th><th>Flags</th><th>Decision</th><th><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{items.map((row) => <tr key={row.id}>
              <th scope="row">{row.name}<span className="table-subtitle">{row.email}</span></th>
              <td>{row.score === null ? screeningState(row.job_status, row.error_code) : <strong>{row.score}<span className="muted"> / 100</span></strong>}</td>
              <td>{row.matched_skills?.slice(0, 3).join(", ") || "—"}</td>
              <td>{row.flags?.length ? `${row.flags.length} to check` : "—"}</td>
              <td><span className={`pill decision-${row.decision || "pending"}`}>{decisionLabel(row.decision || "pending")}</span></td>
              <td><Link className="table-link" href={`${href}/applicants/${row.id}`} aria-label={`Review ${row.name}`}>Review <ArrowUpRight size={15} /></Link></td>
            </tr>)}</tbody>
          </table></div>
        </section>)}
      </>}
    {(page > 1 || (count || 0) > page * size) && <nav className="pagination" aria-label="Application pages">
      {page > 1 && <Link className="button button-secondary" href={pageHref(page - 1)}>Previous</Link>}
      <span>Page {page}</span>
      {(count || 0) > page * size && <Link className="button button-secondary" href={pageHref(page + 1)}>Next</Link>}
    </nav>}
  </>;
}
