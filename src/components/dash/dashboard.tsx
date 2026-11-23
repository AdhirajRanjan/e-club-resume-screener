"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, CalendarDays, FolderPlus, Info, Pencil, Plus, Search, Sparkles, UsersRound } from "lucide-react";
import { CandidateDrawer } from "./candidate-drawer";
import { CandidateIntake } from "./candidate-intake";
import { CandidateTable } from "./candidate-table";
import { MatrixView } from "./matrix-view";
import { ProjectEditor } from "./project-editor";
import { RoleBoard } from "./role-board";
import { RoleManager } from "./role-manager";
import { TeamSuggestion, type Suggestion } from "./team-suggestion";
import { handleTabKeyDown } from "./tab-utils";
import { bucketFor, sampleProjects, type Candidate, type CandidateDraft, type MatchBucket, type Project, type Role, type RoleMatch } from "./types";

type View = "roles" | "matrix" | "candidates" | "manage";
type ProjectForm = { mode: "create" } | { mode: "edit"; project: Project } | null;

function splitTerms(...parts: string[]) {
  return [...new Set(parts.join(" ").toLowerCase().split(/[^a-z0-9+#.]+/).filter((part) => part.length > 2))];
}

function simulateRoleMatch(candidate: Candidate, role: Role): RoleMatch {
  const candidateTerms = splitTerms(candidate.skills.join(" "), candidate.interests.join(" "), candidate.experience);
  const must = role.mustHave;
  const nice = role.niceToHave;
  const matchedMust = must.filter((item) => candidateTerms.some((term) => item.toLowerCase().includes(term) || term.includes(item.toLowerCase())));
  const matchedNice = nice.filter((item) => candidateTerms.some((term) => item.toLowerCase().includes(term) || term.includes(item.toLowerCase())));
  const matchedInterests = role.interestTags.filter((item) => candidateTerms.some((term) => item.toLowerCase().includes(term) || term.includes(item.toLowerCase())));
  const mustScore = must.length ? matchedMust.length / must.length : 0.55;
  const niceScore = nice.length ? matchedNice.length / nice.length : 0.5;
  const interestScore = role.interestTags.length ? matchedInterests.length / role.interestTags.length : 0.5;
  const score = Math.max(0, Math.min(100, Math.round(mustScore * 65 + niceScore * 20 + interestScore * 15)));
  const flags = candidate.experience.length < 45 ? ["Limited detail; review manually"] : [];
  return {
    score,
    matched: [...matchedMust, ...matchedNice, ...matchedInterests],
    missing: [...must.filter((item) => !matchedMust.includes(item)), ...nice.filter((item) => !matchedNice.includes(item))],
    reasoning: "Illustrative keyword overlap from the profile fields only. No resume was parsed and no AI model was called.",
    flags,
  };
}

function escapeCsv(value: string | number | undefined) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(project: Project) {
  const rows = [["candidate", "email", "role", "score", "fit", "matched skills", "missing skills", "flags", "decision", "reviewer note", "confirmed team"]];
  for (const candidate of project.candidates) {
    for (const role of project.roles) {
      const result = candidate.matches[role.id];
      const decision = candidate.decisions[role.id];
      rows.push([
        candidate.name, candidate.email, role.name, result ? String(result.score) : "", result ? bucketFor(result.score) : "",
        result?.matched.join("; ") || "", result?.missing.join("; ") || "", result?.flags.join("; ") || "",
        decision?.status === "unreviewed" ? "" : decision?.status || "", decision?.note || "", project.confirmedTeam[role.id]?.includes(candidate.id) ? "yes" : "no",
      ]);
    }
  }
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}-review.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone?: string }) {
  return <article className={`dash-stat ${tone || ""}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function Dashboard({ mode = "preview" }: { mode?: "preview" | "live" }) {
  const [projects, setProjects] = useState<Project[]>(sampleProjects);
  const [activeProjectId, setActiveProjectId] = useState(sampleProjects[0].id);
  const [view, setView] = useState<View>("roles");
  const [projectForm, setProjectForm] = useState<ProjectForm>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MatchBucket | "unreviewed">("all");
  const [sortRoleId, setSortRoleId] = useState("");
  const [notice, setNotice] = useState("");
  const [matchCount, setMatchCount] = useState(0);

  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0];
  const activeRoleId = activeProject.roles.some((role) => role.id === sortRoleId) ? sortRoleId : activeProject.roles[0]?.id || "";
  const candidate = activeProject.candidates.find((item) => item.id === selectedCandidateId) || null;
  const shortlistedCount = activeProject.candidates.filter((item) => Object.values(item.decisions).some((decision) => decision.status === "shortlist")).length;
  const matchesRun = activeProject.candidates.filter((item) => Object.keys(item.matches).length).length;
  const filteredCandidates = useMemo(() => activeProject.candidates.filter((item) => {
    const searchable = `${item.name} ${item.email} ${item.studentId} ${item.interests.join(" ")} ${item.skills.join(" ")}`.toLowerCase();
    if (query && !searchable.includes(query.toLowerCase())) return false;
    if (filter === "unreviewed" && Object.values(item.decisions).some((decision) => decision.status !== "unreviewed")) return false;
    if (filter !== "all" && filter !== "unreviewed") {
      const topScore = Math.max(0, ...activeProject.roles.map((role) => item.matches[role.id]?.score || 0));
      if (bucketFor(topScore) !== filter) return false;
    }
    return true;
  }), [activeProject, filter, query]);

  function updateProject(projectId: string, updater: (project: Project) => Project) {
    setProjects((current) => current.map((project) => project.id === projectId ? updater(project) : project));
  }

  function saveProject(name: string, description: string, deadline: string, status: Project["status"]) {
    if (projectForm?.mode === "edit") {
      updateProject(projectForm.project.id, (project) => ({ ...project, name, description, deadline, status }));
    } else {
      const created: Project = { id: crypto.randomUUID(), name, description, deadline, status, roles: [], candidates: [], confirmedTeam: {} };
      setProjects((current) => [...current, created]);
      setActiveProjectId(created.id);
      setView("manage");
    }
    setProjectForm(null);
    setNotice("Project changes are temporary and only exist in this browser session.");
  }

  function addCandidates(drafts: CandidateDraft[]) {
    const emails = new Set(activeProject.candidates.map((item) => item.email.trim().toLowerCase()).filter(Boolean));
    const accepted = drafts.filter((draft) => {
      const email = draft.email.trim().toLowerCase();
      if (!email) return true;
      if (emails.has(email)) return false;
      emails.add(email);
      return true;
    });
    const duplicateCount = drafts.length - accepted.length;
    if (!accepted.length) {
      setNotice("Every imported email already exists in this project; no duplicate profiles were added.");
      return;
    }
    const newCandidates: Candidate[] = accepted.map((draft) => ({
      id: crypto.randomUUID(), name: draft.name, email: draft.email, studentId: draft.studentId, year: "Not specified", interests: [], skills: [], experience: "",
      links: draft.links, notes: draft.notes, resumeName: draft.resumeName, extraFiles: draft.extraFiles, source: draft.source, matches: {}, decisions: {},
    }));
    updateProject(activeProject.id, (project) => ({ ...project, candidates: [...project.candidates, ...newCandidates] }));
    setNotice(`${newCandidates.length} fictional profile${newCandidates.length === 1 ? "" : "s"} added${duplicateCount ? `; ${duplicateCount} duplicate email${duplicateCount === 1 ? " was" : "s were"} skipped` : ""}. Nothing was uploaded or saved.`);
  }

  function updateCandidate(candidateId: string, update: Partial<Candidate>) {
    updateProject(activeProject.id, (project) => ({ ...project, candidates: project.candidates.map((item) => item.id === candidateId ? { ...item, ...update } : item) }));
  }

  function saveRole(role: Role) {
    updateProject(activeProject.id, (project) => ({ ...project, roles: project.roles.some((item) => item.id === role.id)
      ? project.roles.map((item) => item.id === role.id ? role : item) : [...project.roles, role] }));
    setNotice("Role updated in this temporary preview.");
  }

  function deleteRole(roleId: string) {
    updateProject(activeProject.id, (project) => {
      const confirmedTeam = { ...project.confirmedTeam };
      delete confirmedTeam[roleId];
      return { ...project, roles: project.roles.filter((role) => role.id !== roleId), candidates: project.candidates.map((item) => {
        const matches = { ...item.matches }; delete matches[roleId];
        const decisions = { ...item.decisions }; delete decisions[roleId];
        return { ...item, matches, decisions };
      }), confirmedTeam };
    });
  }

  function simulateMatching() {
    updateProject(activeProject.id, (project) => ({ ...project, candidates: project.candidates.map((item) => ({
      ...item,
      matches: Object.fromEntries(project.roles.map((role) => [role.id, simulateRoleMatch(item, role)])),
    })) }));
    setMatchCount((count) => count + 1);
    setNotice("Illustrative keyword scores recalculated. This is not Gemini output and should not be used for real candidate decisions.");
  }

  function confirmTeam(assignments: Suggestion[]) {
    const grouped: Record<string, string[]> = {};
    for (const assignment of assignments) grouped[assignment.roleId] = [...(grouped[assignment.roleId] || []), assignment.candidateId];
    updateProject(activeProject.id, (project) => ({ ...project, confirmedTeam: grouped }));
    setNotice("Suggested team saved for this preview session only.");
  }

  if (mode === "live") return <section className="dash-live-blocked panel">
    <span className="dash-empty-icon"><Info size={21} /></span><span className="dash-kicker">Reviewer access verified</span>
    <h1>Live project matching isn&apos;t connected</h1>
    <p>This workspace is a safe, synthetic-data prototype. It cannot read or write applicant records because the requested database connection and schema changes were declined.</p>
    <p>No actual resumes, student information, decisions, or project records are shown here.</p>
    <a className="button" href="/dash-preview">Open synthetic prototype <ArrowUpRight size={16} /></a>
  </section>;

  const strongCount = activeProject.candidates.filter((item) => activeProject.roles.some((role) => item.matches[role.id]?.score >= 70)).length;
  const deadlineLabel = activeProject.deadline ? new Date(`${activeProject.deadline}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "No deadline";

  return <div className="dash-workspace">
    <div className="dash-prototype-banner" role="note"><Info size={17} /><span><strong>Prototype only.</strong> All records and scores are synthetic. Changes stay in memory, files are not uploaded, and no Gemini or Supabase processing occurs.</span></div>
    <header className="dash-heading">
      <div className="dash-heading-copy"><span className="dash-kicker"><span className="dash-kicker-dot" /> Reviewer workspace</span><h1>Project matching</h1>
        <p>Organize candidates by role, compare fit, and prepare a balanced team.</p></div>
      <div className="dash-heading-actions">
        <label className="dash-project-picker"><span className="sr-only">Selected project</span><select value={activeProject.id} onChange={(event) => { setActiveProjectId(event.target.value); setQuery(""); setFilter("all"); }}>
          {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
        <button className="button button-secondary" type="button" onClick={() => setProjectForm({ mode: "edit", project: activeProject })}><Pencil size={15} /> Edit</button>
        <button className="button button-secondary" type="button" onClick={() => setProjectForm({ mode: "create" })}><FolderPlus size={15} /> New project</button>
      </div>
    </header>

    <section className="dash-project-strip panel" aria-label="Selected project summary">
      <div className="dash-project-copy"><div className="row wrap"><span className={`dash-status dash-status-${activeProject.status.toLowerCase()}`}><span />{activeProject.status}</span>
        <span className="dash-project-deadline"><CalendarDays size={14} /> Deadline {deadlineLabel}</span></div>
        <h2>{activeProject.name}</h2><p>{activeProject.description}</p></div>
      <div className="dash-project-actions"><button className="button button-secondary" type="button" onClick={() => setIntakeOpen(true)}><Plus size={16} /> Add candidates</button>
        <button className="button" type="button" onClick={() => setTeamOpen(true)} disabled={!activeProject.roles.length || !activeProject.candidates.length}><UsersRound size={16} /> Suggest team</button></div>
    </section>

    <section className="dash-stats" aria-label="Project overview">
      <SummaryCard label="Candidates" value={activeProject.candidates.length} detail="Across this project" />
      <SummaryCard label="Roles" value={activeProject.roles.length} detail="Defined for the project" />
      <SummaryCard label="Strong fit" value={strongCount} detail="At least one role, illustrative" tone="stat-amber" />
      <SummaryCard label="Shortlisted" value={shortlistedCount} detail="Candidates with a shortlist decision" tone="stat-green" />
    </section>

    {notice && <div className="dash-toast" role="status"><Info size={15} /><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}

    <div className="dash-workbench">
      <div className="dash-workbench-head"><div className="dash-tabs" role="tablist" aria-label="Project views">
        {([["roles", "Role board"], ["matrix", "Fit matrix"], ["candidates", "Candidates"], ["manage", "Manage roles"]] as [View, string][]).map(([key, label]) =>
          <button key={key} id={`dashboard-tab-${key}`} type="button" role="tab" aria-controls="dash-tabpanel" aria-selected={view === key} tabIndex={view === key ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => setView(key)}>{label}</button>)}
      </div>
        {view !== "manage" && <button className="dash-text-button" type="button" onClick={() => setProjectForm({ mode: "edit", project: activeProject })}><Pencil size={14} /> Project details</button>}
      </div>
      {view !== "manage" && <div className="dash-controls">
        <label className="dash-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search candidates</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, skill, or interest" /></label>
        <label className="dash-filter"><span>Fit</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All fits</option><option value="Strong">Strong fit</option><option value="Possible">Possible fit</option><option value="Weak">Weak fit</option><option value="unreviewed">Unreviewed</option>
        </select></label>
        <div className="dash-control-spacer" />
        <span className="dash-results-count">{filteredCandidates.length} of {activeProject.candidates.length} candidates</span>
        <button className="button button-secondary dash-match-button" type="button" disabled={!activeProject.roles.length || !activeProject.candidates.length} onClick={simulateMatching}><Sparkles size={15} /> Simulate fit</button>
        <button className="button button-secondary" type="button" disabled={!activeProject.candidates.length} onClick={() => downloadCsv(activeProject)}><ArrowDownToLine size={15} /> Export CSV</button>
      </div>}
      {matchesRun > 0 && view !== "manage" && <div className="dash-simulation-note"><Sparkles size={14} /><span>Illustrative rules-based scores shown for {matchesRun} profile{matchesRun === 1 ? "" : "s"}{matchCount > 0 ? ` · recalculated ${matchCount} ${matchCount === 1 ? "time" : "times"}` : ""}.</span></div>}
      <div id="dash-tabpanel" className="dash-view-body" role="tabpanel" aria-labelledby={`dashboard-tab-${view}`} tabIndex={0}>
        {view === "roles" && <RoleBoard roles={activeProject.roles} candidates={filteredCandidates} onOpenCandidate={setSelectedCandidateId} />}
        {view === "matrix" && <MatrixView roles={activeProject.roles} candidates={filteredCandidates} sortRoleId={activeRoleId} onSort={setSortRoleId} onOpenCandidate={setSelectedCandidateId} />}
        {view === "candidates" && <CandidateTable roles={activeProject.roles} candidates={filteredCandidates} onOpenCandidate={setSelectedCandidateId} />}
        {view === "manage" && <RoleManager roles={activeProject.roles} onSave={saveRole} onDelete={deleteRole} />}
      </div>
      {view === "roles" && activeProject.roles.length > 0 && <div className="dash-board-foot"><span><span className="legend-dot score-strong" /> Strong 70+</span><span><span className="legend-dot score-possible" /> Possible 40–69</span><span><span className="legend-dot score-weak" /> Weak under 40</span><span className="dash-board-foot-note">Scores are illustrative only.</span></div>}
    </div>

    {projects.length < 8 && <button className="dash-create-inline" type="button" onClick={() => setProjectForm({ mode: "create" })}><FolderPlus size={16} /> Create another project</button>}

    {projectForm && <ProjectEditor project={projectForm.mode === "edit" ? projectForm.project : undefined} onClose={() => setProjectForm(null)} onSave={saveProject} />}
    {intakeOpen && <CandidateIntake onClose={() => setIntakeOpen(false)} onAdd={addCandidates} />}
    {teamOpen && <TeamSuggestion project={activeProject} onClose={() => setTeamOpen(false)} onConfirm={confirmTeam} />}
    {candidate && <CandidateDrawer project={activeProject} candidate={candidate} onClose={() => setSelectedCandidateId(null)} onUpdate={updateCandidate} />}
  </div>;
}
