import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ClipboardList } from "lucide-react";
import { Empty } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "My applications" };

export default async function Applications({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { db, profile } = await requireSession("applicant");
  const { submitted } = await searchParams;
  const { data, error } = await db.from("applications")
    .select("id,project_id,submitted_at,status,projects(name,deadline,status)").eq("user_id", profile.id)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error("applications_load_failed");
  const rows = (data || []) as unknown as { id: string; project_id: string; submitted_at: string; status: string;
    projects: { name: string; deadline: string; status: string } | null }[];
  return <>
    <header className="page-heading"><h1>My applications</h1><p>Track the applications you’ve submitted to E-Club projects.</p></header>
    {rows.some(({ id }) => id === submitted) && <div className="notice notice-success" role="status">
      <CheckCircle2 size={18} aria-hidden="true" /> Your application was submitted.
    </div>}
    {!rows.length ? <Empty icon={ClipboardList} title="You haven’t applied yet"
      action={<Link className="button" href="/projects">Explore projects</Link>}>Your submissions will appear here.</Empty>
      : <div className="panel table-scroll"><table>
        <caption className="sr-only">Your submitted applications</caption>
        <thead><tr><th>Project</th><th>Submitted</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <th scope="row">{row.projects?.name || "Project"}</th>
          <td><time dateTime={row.submitted_at}>{formatDateTime(row.submitted_at)}</time></td>
          <td><span className="pill">{row.status === "submitted" ? "Submitted" : "Under review"}</span></td>
          <td><Link className="table-link" href={`/projects/${row.project_id}`} aria-label={`View ${row.projects?.name || "project"}`}>View <ArrowUpRight size={15} /></Link></td>
        </tr>)}</tbody>
      </table></div>}
  </>;
}
