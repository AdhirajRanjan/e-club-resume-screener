import { ProjectEditor } from "@/components/project-editor";
import { Back } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { deadlinePassed, getProject, getRubric } from "@/lib/data";

export const metadata = { title: "Edit project" };

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const { db, profile } = await requireSession("reviewer");
  const { id } = await params;
  const project = await getProject(db, id, profile.id);
  const rubric = await getRubric(db, id, project.rubric_version);
  return <><Back href={`/reviewer/${id}`}>{project.name}</Back>
    <header className="page-heading"><h1>Edit project</h1><p>{project.name}</p></header>
    <ProjectEditor project={project} rubric={rubric} past={deadlinePassed(project.deadline)} /></>;
}
