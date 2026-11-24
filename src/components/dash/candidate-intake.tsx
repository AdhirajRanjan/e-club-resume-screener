"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { FilePlus2, FileSpreadsheet, Upload, X } from "lucide-react";
import { DashDialog } from "./dialog";
import { handleTabKeyDown } from "./tab-utils";
import type { CandidateDraft } from "./types";

type Mode = "single" | "bulk" | "import";
type ImportRow = { name: string; email: string; studentId: string; links: CandidateDraft["links"]; answers: Record<string, string>; matchedFile?: File };
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 100;

function validPdfs(files: File[]) {
  const invalid = files.filter((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
  const oversized = files.filter((file) => file.size > MAX_PDF_BYTES);
  return { invalid, oversized, accepted: files.filter((file) => !invalid.includes(file) && !oversized.includes(file)).slice(0, MAX_FILES) };
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function CandidateIntake({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (candidates: CandidateDraft[]) => void;
}) {
  const [mode, setMode] = useState<Mode>("single");
  const [feedback, setFeedback] = useState("");
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [resume, setResume] = useState<File | null>(null);
  const [extras, setExtras] = useState<File[]>([]);
  const [csvName, setCsvName] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const unmatched = useMemo(() => importRows.filter((row) => !row.matchedFile), [importRows]);

  function acceptBulk(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    const overLimit = files.length > MAX_FILES;
    const result = validPdfs(files);
    setBulkFiles(result.accepted);
    setFeedback(overLimit
      ? `Only the first ${MAX_FILES} files were checked.`
      : result.invalid.length || result.oversized.length
        ? `${result.invalid.length} unsupported file(s) and ${result.oversized.length} file(s) over 5 MB were skipped.`
        : `${result.accepted.length} PDF${result.accepted.length === 1 ? "" : "s"} ready for the local preview.`);
  }

  function singleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!resume || resume.type !== "application/pdf" && !resume.name.toLowerCase().endsWith(".pdf")) {
      setFeedback("Attach a PDF resume before adding this sample candidate."); return;
    }
    if (resume.size > MAX_PDF_BYTES) { setFeedback("The resume must be 5 MB or smaller."); return; }
    if (extras.length > 3 || extras.some((file) => file.size > MAX_PDF_BYTES || (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")))) {
      setFeedback("Choose up to three additional PDF files, each 5 MB or smaller."); return;
    }
    onAdd([{
      name: String(form.get("name") || "").trim(), email: String(form.get("email") || "").trim(), studentId: String(form.get("studentId") || "").trim(),
      resumeName: resume.name, extraFiles: extras.map((file) => file.name), source: "upload",
      notes: String(form.get("notes") || "").trim(),
      links: ["portfolio", "linkedin", "github", "drive"].flatMap((key) => {
        const value = String(form.get(key) || "").trim();
        if (!value) return [];
        try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? [{ label: key === "drive" ? "Drive" : key, url: url.toString() }] : []; }
        catch { return []; }
      }),
    }]);
    onClose();
  }

  function addBulk() {
    if (!bulkFiles.length) { setFeedback("Choose PDF files to continue."); return; }
    onAdd(bulkFiles.map((file) => ({ name: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "), email: "", studentId: "", resumeName: file.name, extraFiles: [], source: "upload", notes: "", links: [] })));
    onClose();
  }

  async function readCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setFeedback(""); setCsvName(file.name);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) { setImportRows([]); setFeedback("The CSV needs a header row and at least one candidate row."); return; }
      const headers = parsed[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
      const nameIndex = headers.findIndex((header) => ["name", "full_name", "applicant_name"].includes(header));
      const emailIndex = headers.findIndex((header) => ["email", "applicant_email", "email_address"].includes(header));
      const studentIdIndex = headers.findIndex((header) => ["student_id", "student_number", "university_id"].includes(header));
      const linkFields = [
        { label: "Portfolio", names: ["portfolio", "portfolio_url"] },
        { label: "LinkedIn", names: ["linkedin", "linkedin_url"] },
        { label: "GitHub", names: ["github", "github_url"] },
        { label: "Drive", names: ["drive_link", "drive_url", "resume_link"] },
      ];
      const linkHeaders = linkFields.flatMap((field) => field.names);
      if (nameIndex < 0) { setImportRows([]); setFeedback("Add a name or full_name column to the CSV."); return; }
      setImportRows(parsed.slice(1).map((cells) => ({
        name: cells[nameIndex] || "", email: emailIndex >= 0 ? cells[emailIndex] || "" : "",
        studentId: studentIdIndex >= 0 ? cells[studentIdIndex] || "" : "",
        links: linkFields.flatMap((field) => {
          const index = field.names.map((name) => headers.indexOf(name)).find((candidateIndex) => candidateIndex >= 0);
          const value = index === undefined ? "" : cells[index] || "";
          try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? [{ label: field.label, url: url.toString() }] : []; }
          catch { return []; }
        }),
        answers: Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]).filter(([header]) => !["name", "full_name", "applicant_name", "email", "applicant_email", "email_address", "student_id", "student_number", "university_id", ...linkHeaders].includes(header))),
      })).filter((row) => row.name));
      setFeedback("");
    } catch {
      setImportRows([]); setFeedback("This CSV could not be read. Check its encoding and try again.");
    } finally { setBusy(false); }
  }

  function matchImports(files: File[]) {
    const result = validPdfs(files);
    setImportRows((current) => current.map((row) => {
      const normalizedName = row.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const normalizedEmail = row.email.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const matchedFile = result.accepted.find((file) => {
        const normalizedFile = file.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
        return normalizedFile.includes(normalizedName) || (normalizedEmail.length > 3 && normalizedFile.includes(normalizedEmail.split("@")[0]));
      });
      return { ...row, matchedFile };
    }));
    setFeedback(result.invalid.length || result.oversized.length ? "Some files were skipped. Only PDFs up to 5 MB are accepted." : `${result.accepted.length} PDFs checked locally.`);
  }

  function addImported() {
    const matched = importRows.filter((row) => row.matchedFile);
    if (!matched.length) { setFeedback("Choose the CSV and matching PDF resumes first."); return; }
    onAdd(matched.map((row) => ({ name: row.name, email: row.email, studentId: row.studentId, resumeName: row.matchedFile?.name || "", extraFiles: [], source: "import", notes: Object.entries(row.answers).map(([key, value]) => `${key}: ${value}`).join("\n"), links: row.links })));
    onClose();
  }

  return <DashDialog className="dash-dialog-modal" labelledBy="intake-title" onClose={onClose}>
    <section className="dash-modal intake-modal">
      <div className="dash-modal-head"><div><span className="dash-kicker">Candidate intake</span><h2 id="intake-title">Add candidates</h2>
        <p>Choose a single profile, bulk PDFs, or a CSV with matching resume files.</p></div><button type="button" className="dash-icon-button" onClick={onClose} aria-label="Close candidate intake"><X size={18} /></button></div>
      <div className="intake-tabs" role="tablist" aria-label="Candidate intake method">
        {([ ["single", "Single"], ["bulk", "Bulk PDF"], ["import", "CSV import"] ] as [Mode, string][]).map(([value, label]) => <button type="button" id={`intake-tab-${value}`} role="tab" aria-controls="candidate-intake-panel" aria-selected={mode === value} tabIndex={mode === value ? 0 : -1} key={value} onKeyDown={handleTabKeyDown} onClick={() => { setMode(value); setFeedback(""); }}>{label}</button>)}
      </div>
      <div id="candidate-intake-panel" role="tabpanel" aria-labelledby={`intake-tab-${mode}`} tabIndex={0}>
      {mode === "single" && <form className="dash-form intake-form" onSubmit={singleSubmit}>
        <div className="form-grid"><label>Candidate name<input name="name" required maxLength={100} placeholder="Full name" /></label><label>Email<input name="email" type="email" required maxLength={254} placeholder="name@example.edu" /></label></div>
        <label>Student ID <span className="optional">optional in this preview</span><input name="studentId" maxLength={40} /></label>
        <label>Resume (PDF)<input required type="file" accept="application/pdf,.pdf" onChange={(event) => setResume(event.target.files?.[0] || null)} /><small>Up to 5 MB. The prototype reads only the filename.</small></label>
        <label>Additional files <span className="optional">up to 3 PDFs</span><input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => setExtras(Array.from(event.target.files || []).slice(0, 3))} /></label>
        <div className="form-grid"><label>Portfolio link <span className="optional">optional</span><input name="portfolio" type="url" placeholder="https://" /></label><label>LinkedIn <span className="optional">optional</span><input name="linkedin" type="url" placeholder="https://" /></label></div>
        <div className="form-grid"><label>GitHub <span className="optional">optional</span><input name="github" type="url" placeholder="https://" /></label><label>Drive link <span className="optional">optional</span><input name="drive" type="url" placeholder="https://drive.google.com/…" /></label></div>
        <label>Reviewer note <span className="optional">optional</span><textarea name="notes" rows={2} maxLength={1500} /></label>
        <p className="intake-disclaimer">Files are not uploaded or stored. This is a temporary in-browser preview.</p>
        {feedback && <p className="notice notice-error" role="alert">{feedback}</p>}
        <div className="row wrap end"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button"><FilePlus2 size={16} /> Add candidate</button></div>
      </form>}
      {mode === "bulk" && <div className="dash-form intake-form">
        <label className="upload-zone"><Upload size={24} /><strong>Select PDF resumes</strong><span>Up to {MAX_FILES} files · 5 MB each</span><input type="file" accept="application/pdf,.pdf" multiple onChange={acceptBulk} /></label>
        {bulkFiles.length > 0 && <ul className="selected-file-list">{bulkFiles.slice(0, 8).map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}{bulkFiles.length > 8 && <li>and {bulkFiles.length - 8} more</li>}</ul>}
        <p className="intake-disclaimer">In the live app, bulk upload requires approved storage access. Here, only filenames are added to temporary sample state.</p>
        {feedback && <p className="notice" role="status">{feedback}</p>}
        <div className="row wrap end"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="button" className="button" onClick={addBulk} disabled={!bulkFiles.length}>Add {bulkFiles.length || ""} sample profiles</button></div>
      </div>}
      {mode === "import" && <div className="dash-form intake-form">
        <label><span className="intake-label-icon"><FileSpreadsheet size={16} /> Response sheet CSV</span><input type="file" accept=".csv,text/csv" onChange={readCsv} /><small>Include a name or full_name column. Email is optional.</small></label>
        <label>Matching resume PDFs<input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => matchImports(Array.from(event.target.files || []))} /><small>Names or email prefixes are compared locally to filenames.</small></label>
        {csvName && <div className="import-summary"><strong>{csvName}</strong><span>{importRows.length} rows · {importRows.length - unmatched.length} matched · {unmatched.length} unmatched</span></div>}
        {!!importRows.length && <div className="import-table"><table><thead><tr><th>Name</th><th>Email</th><th>Resume</th></tr></thead><tbody>{importRows.slice(0, 12).map((row, index) => <tr key={`${row.name}-${index}`}><td>{row.name}</td><td>{row.email || "—"}</td><td>{row.matchedFile?.name || <span className="text-danger">Not matched</span>}</td></tr>)}</tbody></table>{importRows.length > 12 && <small>Showing the first 12 rows.</small>}</div>}
        {feedback && <p className="notice" role="status">{feedback}</p>}
        <p className="intake-disclaimer">CSV values and file names stay in this browser and are discarded when you leave the page.</p>
        <div className="row wrap end"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="button" className="button" onClick={addImported} disabled={busy || !importRows.some((row) => row.matchedFile)}>Add matched profiles</button></div>
      </div>}
      </div>
    </section>
  </DashDialog>;
}
