"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, RefreshCw, UsersRound } from "lucide-react";
import { DashDialog } from "./dialog";
import type { Project } from "./types";

type Suggestion = { roleId: string; candidateId: string; score: number };

function suggest(project: Project): Suggestion[] {
  const used = new Set<string>();
  const assignments: Suggestion[] = [];
  const orderedRoles = [...project.roles].sort((left, right) => left.openings - right.openings);
  for (const role of orderedRoles) {
    const pool = project.candidates.map((candidate) => ({ candidate, score: candidate.matches[role.id]?.score ?? -1 }))
      .filter(({ candidate, score }) => score >= 40 && !used.has(candidate.id))
      .sort((left, right) => right.score - left.score);
    for (const item of pool.slice(0, role.openings)) {
      used.add(item.candidate.id);
      assignments.push({ roleId: role.id, candidateId: item.candidate.id, score: item.score });
    }
  }
  return assignments;
}

export function TeamSuggestion({ project, onClose, onConfirm }: {
  project: Project;
  onClose: () => void;
  onConfirm: (assignments: Suggestion[]) => void;
}) {
  const initial = useMemo(() => suggest(project), [project]);
  const [assignments, setAssignments] = useState<Suggestion[]>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const candidateById = new Map(project.candidates.map((candidate) => [candidate.id, candidate]));

  function assign(roleId: string, index: number, candidateId: string) {
    setAssignments((current) => current.map((item) => item.roleId === roleId && current.filter((entry) => entry.roleId === roleId).indexOf(item) === index
      ? { roleId, candidateId, score: candidateById.get(candidateId)?.matches[roleId]?.score ?? 0 }
      : item));
  }

  return <DashDialog className="dash-dialog-modal" labelledBy="team-title" onClose={onClose}>
    <section className="dash-modal team-modal">
      <div className="dash-modal-head"><div><span className="dash-kicker">Capacity-aware suggestion</span><h2 id="team-title">Suggested team</h2>
        <p>One candidate is suggested for at most one role. Change assignments before confirming.</p></div>
        <button className="dash-icon-button" type="button" aria-label="Close team suggestions" onClick={onClose}>×</button></div>
      {assignments.length ? <div className="team-suggestions">{project.roles.map((role) => {
        const entries = assignments.filter((item) => item.roleId === role.id);
        if (!entries.length) return null;
        return <section className="team-role" key={role.id}><div className="row between"><h3>{role.name}</h3><span className="muted">{entries.length} of {role.openings} openings</span></div>
          {entries.map((entry, index) => <div className="team-assignment" key={`${entry.roleId}-${index}`}>
            <label><span className="sr-only">Candidate for {role.name}</span><select value={entry.candidateId} onChange={(event) => assign(role.id, index, event.target.value)}>
              {project.candidates.filter((candidate) => candidate.id === entry.candidateId || ((candidate.matches[role.id]?.score ?? 0) >= 40 && !assignments.some((assignment) => assignment.candidateId === candidate.id)))
                .map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name} · {candidate.matches[role.id]?.score ?? 0}</option>)}
            </select></label><span className="team-score">{entry.score} fit</span>
          </div>)}
        </section>;
      })}</div> : <div className="dash-empty"><span className="dash-empty-icon"><UsersRound size={22} /></span><strong>No suggested assignments</strong><span>Add roles and candidates with a possible-or-better fit to generate suggestions.</span></div>}
      {confirmed && <div className="notice notice-success" role="status"><Check size={16} /> Team suggestion confirmed for this session.</div>}
      <div className="team-disclaimer"><RefreshCw size={15} /><span>Suggestions use illustrative fit scores only. Review every assignment before acting.</span></div>
      <div className="row wrap between"><button type="button" className="dash-text-button" onClick={() => setAssignments(suggest(project))}><RefreshCw size={15} /> Recalculate</button>
        <div className="row wrap"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="button" className="button" disabled={!assignments.length} onClick={() => { onConfirm(assignments); setConfirmed(true); }}>
          Confirm suggestions <ArrowRight size={16} /></button></div></div>
    </section>
  </DashDialog>;
}

export type { Suggestion };
