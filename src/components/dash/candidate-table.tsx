import { ArrowUpRight, UserRound } from "lucide-react";
import { bucketFor, scoreClass, type Candidate, type Role } from "./types";

export function CandidateTable({ roles, candidates, onOpenCandidate }: {
  roles: Role[];
  candidates: Candidate[];
  onOpenCandidate: (candidateId: string) => void;
}) {
  if (!candidates.length) return <div className="dash-empty"><span className="dash-empty-icon"><UserRound size={22} /></span>
    <strong>No candidates in this project</strong><span>Import a response sheet or add candidates to begin the review.</span></div>;
  return <div className="dash-table-wrap panel"><table>
    <caption className="sr-only">Candidate profiles and their best role fit</caption>
    <thead><tr><th scope="col">Candidate</th><th scope="col">Interests</th><th scope="col">Best fit</th><th scope="col">Score</th><th scope="col">Decision</th><th scope="col"><span className="sr-only">Open profile</span></th></tr></thead>
    <tbody>{candidates.map((candidate) => {
      const best = roles.map((role) => ({ role, match: candidate.matches[role.id] }))
        .filter((item) => item.match).sort((a, b) => b.match.score - a.match.score)[0];
      const shortlists = Object.values(candidate.decisions).filter((decision) => decision.status === "shortlist").length;
      return <tr key={candidate.id}>
        <th scope="row"><button type="button" className="dash-table-person" onClick={() => onOpenCandidate(candidate.id)}>{candidate.name}
          <span>{candidate.email} <span aria-hidden="true">·</span> {candidate.studentId || "ID not provided"} <span aria-hidden="true">·</span> {candidate.year}</span></button></th>
        <td>{candidate.interests.slice(0, 2).join(", ") || "—"}</td>
        <td>{best?.role.name || "Not matched"}</td>
        <td>{best ? <span className={`score-badge ${scoreClass(best.match.score)}`}>{best.match.score} <span>{bucketFor(best.match.score)}</span></span> : "—"}</td>
        <td>{shortlists ? <span className="decision-count">{shortlists} shortlisted</span> : <span className="muted">Awaiting review</span>}</td>
        <td><button className="dash-icon-button" type="button" aria-label={`Open ${candidate.name}`} onClick={() => onOpenCandidate(candidate.id)}><ArrowUpRight size={17} /></button></td>
      </tr>;
    })}</tbody>
  </table></div>;
}
