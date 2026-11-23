"use client";

import { useState, type FormEvent } from "react";
import { DashDialog } from "./dialog";
import type { Project } from "./types";

export function ProjectEditor({ project, onClose, onSave }: {
  project?: Project;
  onClose: () => void;
  onSave: (name: string, description: string, deadline: string, status: Project["status"]) => void;
}) {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const deadline = String(form.get("deadline") || "");
    const status = String(form.get("status") || "Draft") as Project["status"];
    if (name.length < 3 || !description || !deadline) {
      setError("Enter a project name, description, and deadline.");
      return;
    }
    onSave(name, description, deadline, status);
  }

  return <DashDialog className="dash-dialog-modal" labelledBy="project-form-title" onClose={onClose}>
    <section className="dash-modal">
      <div className="dash-modal-head"><div><span className="dash-kicker">Project setup</span><h2 id="project-form-title">{project ? "Edit project" : "Create a project"}</h2></div>
        <button className="dash-icon-button" type="button" aria-label="Close project form" onClick={onClose}>×</button></div>
      <form className="dash-form" onSubmit={submit}>
        <label>Project name<input name="name" required maxLength={100} defaultValue={project?.name} placeholder="e.g. Campus Signal" /></label>
        <label>Description<textarea name="description" rows={4} required maxLength={800} defaultValue={project?.description} placeholder="What is the project working on?" /></label>
        <div className="form-grid"><label>Application deadline<input name="deadline" type="date" required defaultValue={project?.deadline || "2027-01-15"} /></label>
          <label>Status<select name="status" defaultValue={project?.status || "Draft"}><option>Draft</option><option>Open</option><option>Closed</option></select></label></div>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <div className="row wrap end"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button" type="submit">{project ? "Save project" : "Create project"}</button></div>
      </form>
    </section>
  </DashDialog>;
}
