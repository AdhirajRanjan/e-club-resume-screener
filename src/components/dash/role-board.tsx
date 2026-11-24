import { ArrowUpRight, UsersRound } from "lucide-react";
import { bucketFor, scoreClass, type Candidate, type Role } from "./types";

export function RoleBoard({ roles, candidates, onOpenCandidate }: {
  roles: Role[];
  candidates: Candidate[];
  onOpenCandidate: (candidateId: string) => void;
}) {
  if (!roles.length) return <div className="dash-empty"><strong>No roles yet</strong><span>Add a role to start organizing applicants by fit.</span></div>;

  return <div className="role-board">
    {roles.map((role) => {
      const ranked = [...candidates].sort((left, right) =>
        (right.matches[role.id]?.score ?? -1) - (left.matches[role.id]?.score ?? -1));
      const shortlisted = candidates.filter((candidate) => candidate.decisions[role.id]?.status === "shortlist").length;
      return <section className="role-column" key={role.id} aria-labelledby={`role-${role.id}`}>
        <header className="role-column-head">
          <div><h3 id={`role-${role.id}`}>{role.name}</h3><p>{role.openings} {role.openings === 1 ? "opening" : "openings"}</p></div>
          <span className="role-capacity"><UsersRound size={14} aria-hidden="true" /> {shortlisted}/{role.openings}</span>
        </header>
        <div className="role-cards">
          {ranked.map((candidate) => {
            const result = candidate.matches[role.id];
            if (!result) return null;
            return <button className="candidate-card" key={candidate.id} type="button" onClick={() => onOpenCandidate(candidate.id)}>
              <span className="candidate-card-top"><strong>{candidate.name}</strong><span className={`score-badge ${scoreClass(result.score)}`}>{result.score}</span></span>
              <span className="candidate-card-meta">{candidate.year} <span aria-hidden="true">·</span> {bucketFor(result.score)}</span>
              <span className="candidate-card-skills">{result.matched.slice(0, 3).join(" · ") || "No matched skills yet"}</span>
              {result.flags.length > 0 && <span className="candidate-flag">{result.flags[0]}</span>}
              <span className="candidate-card-open">Open profile <ArrowUpRight size={14} aria-hidden="true" /></span>
            </button>;
          })}
        </div>
      </section>;
    })}
  </div>;
}
