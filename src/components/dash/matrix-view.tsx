import { bucketFor, scoreClass, type Candidate, type Role } from "./types";

export function MatrixView({ roles, candidates, sortRoleId, onSort, onOpenCandidate }: {
  roles: Role[];
  candidates: Candidate[];
  sortRoleId: string;
  onSort: (roleId: string) => void;
  onOpenCandidate: (candidateId: string) => void;
}) {
  const sorted = [...candidates].sort((left, right) =>
    (right.matches[sortRoleId]?.score ?? -1) - (left.matches[sortRoleId]?.score ?? -1));

  if (!roles.length || !candidates.length) return <div className="dash-empty"><strong>Nothing to compare yet</strong><span>Add roles and candidate profiles to populate the matrix.</span></div>;

  return <div className="dash-table-wrap panel">
    <table className="matrix-table">
      <caption className="sr-only">Fictional candidate-to-role fit matrix</caption>
      <thead><tr><th scope="col">Candidate</th>{roles.map((role) => <th scope="col" key={role.id}>
        <button className="matrix-sort" type="button" onClick={() => onSort(role.id)} aria-pressed={sortRoleId === role.id}>
          {role.name}{sortRoleId === role.id && <span aria-hidden="true"> ↓</span>}
        </button></th>)}<th scope="col">Best fit</th></tr></thead>
      <tbody>{sorted.map((candidate) => {
        const ranked = roles.map((role) => ({ role, score: candidate.matches[role.id]?.score ?? -1 }))
          .sort((a, b) => b.score - a.score);
        const best = ranked[0];
        return <tr key={candidate.id}>
          <th scope="row"><button className="matrix-candidate" type="button" onClick={() => onOpenCandidate(candidate.id)}>
            {candidate.name}<span>{candidate.year}</span></button></th>
          {roles.map((role) => {
            const score = candidate.matches[role.id]?.score;
            return <td key={role.id}>{score === undefined ? <span className="matrix-score matrix-empty">—</span>
              : <span className={`matrix-score ${scoreClass(score)}`} title={`${bucketFor(score)} fit`}>{score}</span>}</td>;
          })}
          <td><span className="best-fit-label">{best && best.score >= 0 ? best.role.name : "—"}</span></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
