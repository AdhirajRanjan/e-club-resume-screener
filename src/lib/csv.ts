export const csvColumns = {
  name: "Applicant name", email: "Email", student_id: "Student ID", project: "Project",
  score: "AI score", bucket: "AI bucket", matched_skills: "Matched skills", missing_skills: "Unverified criteria",
  flags: "Flags", decision: "Final reviewer decision", note: "Reviewer note",
  submitted_at: "Submission timestamp", decided_at: "Decision timestamp",
} as const;

type Key = keyof typeof csvColumns;
type Cell = string | string[] | number | null | undefined;
export type CsvRow = Record<Key, Cell>;

export function csvCell(value: Cell) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  const safe = /^[\s\u0000-\u001f\u200b-\u200f\ufeff]*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n]/.test(text)
    ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function shortlistCsv(rows: CsvRow[]) {
  const keys = Object.keys(csvColumns) as Key[];
  return "\ufeff" + [keys.map((key) => csvCell(csvColumns[key])).join(","),
    ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(","))].join("\r\n") + "\r\n";
}
