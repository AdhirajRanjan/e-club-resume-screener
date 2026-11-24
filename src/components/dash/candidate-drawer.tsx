"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, FileText, X } from "lucide-react";
import { DashDialog } from "./dialog";
import { bucketFor, scoreClass, type Candidate, type Decision, type Project, type Role } from "./types";

export function CandidateDrawer({ project, candidate, onClose, onUpdate }: {
  project: Project;
  candidate: Candidate;
  onClose: () => void;
  onUpdate: (candidateId: string, update: Partial<Candidate>) => void;
}) {
  const [editingProfile, setEditingProfile] = useState(false);
  const alreadyShortlisted = Object.values(candidate.decisions).filter((decision) => decision.status === "shortlist").length > 1;

  function saveDecision(role: Role, status: Decision, note: string) {
    onUpdate(candidate.id, { decisions: { ...candidate.decisions, [role.id]: { status, note } } });
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onUpdate(candidate.id, {
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      studentId: String(form.get("studentId") || "").trim(),
      year: String(form.get("year") || "").trim(),
      interests: String(form.get("interests") || "").split(",").map((item) => item.trim()).filter(Boolean),
      skills: String(form.get("skills") || "").split(",").map((item) => item.trim()).filter(Boolean),
      experience: String(form.get("experience") || "").trim(),
    });
    setEditingProfile(false);
  }

  return <DashDialog className="dash-dialog-side" labelledBy="candidate-name" onClose={onClose}>
    <aside className="candidate-drawer">
      <header className="candidate-drawer-head"><div><span className="dash-kicker">Fictional applicant profile</span><h2 id="candidate-name">{candidate.name}</h2>
        <p>{candidate.year} <span aria-hidden="true">·</span> {candidate.email || "No email added"} <span aria-hidden="true">·</span> ID {candidate.studentId || "not provided"}</p></div>
        <button className="dash-icon-button" type="button" aria-label="Close profile" onClick={onClose}><X size={19} /></button>
      </header>
      {editingProfile ? <form className="dash-form drawer-profile-form" onSubmit={saveProfile}>
        <label>Name<input name="name" required defaultValue={candidate.name} maxLength={100} /></label>
        <label>Email<input name="email" type="email" defaultValue={candidate.email} maxLength={254} /></label>
        <label>Student ID<input name="studentId" defaultValue={candidate.studentId} maxLength={40} /></label>
        <label>Year<input name="year" defaultValue={candidate.year} maxLength={30} /></label>
        <label>Interests <span className="optional">comma-separated</span><input name="interests" defaultValue={candidate.interests.join(", ")} /></label>
        <label>Skills <span className="optional">comma-separated</span><input name="skills" defaultValue={candidate.skills.join(", ")} /></label>
        <label>Experience<textarea name="experience" rows={4} defaultValue={candidate.experience} maxLength={2000} /></label>
        <div className="row wrap end"><button type="button" className="button button-secondary" onClick={() => setEditingProfile(false)}>Cancel</button><button type="submit" className="button">Save profile</button></div>
      </form> : <>
        <section className="drawer-section">
          <div className="row between"><h3>Profile summary</h3><button type="button" className="dash-text-button" onClick={() => setEditingProfile(true)}>Edit profile</button></div>
          <p className="drawer-copy">{candidate.experience || "No experience summary added."}</p>
          <div className="drawer-detail"><span className="dash-label">Interests</span><ul className="tags">{candidate.interests.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className="drawer-detail"><span className="dash-label">Skills</span><ul className="tags">{candidate.skills.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </section>
        <section className="drawer-section"><h3>Application files</h3>
          <div className="file-chip"><FileText size={16} /><span>{candidate.resumeName || "No resume attached"}</span><span className="file-chip-status">Synthetic</span></div>
          {candidate.extraFiles.map((file) => <div className="file-chip" key={file}><FileText size={16} /><span>{file}</span><span className="file-chip-status">Additional</span></div>)}
          <p className="drawer-help">File names only. This prototype does not upload, open, or store resume files.</p>
        </section>
        {!!candidate.links.length && <section className="drawer-section"><h3>Links</h3><ul className="drawer-links">{candidate.links.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.label}<ArrowUpRight size={14} /></a></li>)}</ul></section>}
        <section className="drawer-section"><div className="row between"><h3>Role fit</h3><span className="dash-label">Illustrative scores</span></div>
          {project.roles.map((role) => {
            const result = candidate.matches[role.id];
            const decision = candidate.decisions[role.id];
            return <article className="drawer-role-match" key={role.id}>
              <div className="row between"><strong>{role.name}</strong>{result ? <span className={`score-badge ${scoreClass(result.score)}`}>{result.score} · {bucketFor(result.score)}</span> : <span className="muted">Not matched</span>}</div>
              {result && <><p>{result.reasoning}</p><div className="match-evidence"><span><b>Matched:</b> {result.matched.join(", ") || "None listed"}</span><span><b>Missing:</b> {result.missing.join(", ") || "None listed"}</span></div>
                {result.flags.map((flag) => <span className="candidate-flag" key={flag}>{flag}</span>)}</>}
              <label className="decision-label">Decision for this role<select value={decision?.status === "unreviewed" ? "" : decision?.status || ""} onChange={(event) => {
                const status = event.target.value as Decision | "";
                if (status) saveDecision(role, status, decision?.note || "");
                else if (decision?.note) onUpdate(candidate.id, { decisions: { ...candidate.decisions, [role.id]: { status: "unreviewed", note: decision.note } } });
                else { const next = { ...candidate.decisions }; delete next[role.id]; onUpdate(candidate.id, { decisions: next }); }
              }}><option value="">Not reviewed</option><option value="shortlist">Shortlist</option><option value="hold">Hold</option><option value="reject">Reject</option></select></label>
              <label className="decision-label">Reviewer note<textarea rows={2} maxLength={1000} value={decision?.note || ""} onChange={(event) => onUpdate(candidate.id, { decisions: { ...candidate.decisions, [role.id]: { status: decision?.status || "unreviewed", note: event.target.value } } })} placeholder="Add a note for the reviewer team." /></label>
            </article>;
          })}
          {alreadyShortlisted && <div className="notice notice-warning" role="status">This candidate is shortlisted for more than one role. Check total workload before confirming a team.</div>}
        </section>
        <section className="drawer-section"><h3>Additional reviewer notes</h3><label className="sr-only" htmlFor="candidate-notes">Additional reviewer notes</label>
          <textarea id="candidate-notes" rows={3} maxLength={1500} value={candidate.notes} onChange={(event) => onUpdate(candidate.id, { notes: event.target.value })} placeholder="Private team note…" /></section>
      </>}
      <footer className="candidate-drawer-foot"><span>Added via {candidate.source === "import" ? "response import" : "single upload"}</span><span>Not shared with candidates</span></footer>
    </aside>
  </DashDialog>;
}
