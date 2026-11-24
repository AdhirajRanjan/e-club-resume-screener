"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { DashDialog } from "./dialog";
import type { Role } from "./types";

const emptyRole = (): Role => ({ id: crypto.randomUUID(), name: "", description: "", openings: 1, mustHave: [], niceToHave: [], interestTags: [] });
const splitItems = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function RoleManager({ roles, onSave, onDelete }: {
  roles: Role[];
  onSave: (role: Role) => void;
  onDelete: (roleId: string) => void;
}) {
  const [editing, setEditing] = useState<Role | null>(null);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const openings = Number(form.get("openings"));
    const next = {
      ...(editing || emptyRole()), name, description, openings,
      mustHave: splitItems(String(form.get("mustHave") || "")),
      niceToHave: splitItems(String(form.get("niceToHave") || "")),
      interestTags: splitItems(String(form.get("interestTags") || "")),
    };
    if (!name || !description || !Number.isInteger(openings) || openings < 1 || openings > 25) {
      setError("Add a name, description, and between 1 and 25 openings.");
      return;
    }
    onSave(next);
    setEditing(null);
    setError("");
  }

  return <section className="dash-section">
    <div className="dash-section-heading"><div><span className="dash-kicker">Project setup</span><h2>Roles</h2>
      <p>Define the work and the evidence that matters. You can change roles at any time in this prototype.</p></div>
      <button className="button" type="button" onClick={() => setEditing(emptyRole())}><Plus size={16} /> Add role</button>
    </div>
    {roles.length ? <div className="role-manage-grid">{roles.map((role) => <article className="role-manage-card panel" key={role.id}>
      <div className="role-manage-top"><span className="icon-tile"><UsersRound size={19} /></span>
        <div className="row"><button className="dash-icon-button" type="button" aria-label={`Edit ${role.name}`} onClick={() => setEditing(role)}><Pencil size={16} /></button>
          <button className="dash-icon-button danger" type="button" aria-label={`Delete ${role.name}`} onClick={() => onDelete(role.id)}><Trash2 size={16} /></button></div>
      </div>
      <h3>{role.name}</h3><p>{role.description}</p>
      <span className="role-openings">{role.openings} {role.openings === 1 ? "opening" : "openings"}</span>
      <div><small className="dash-label">Must-have</small><ul className="tags">{role.mustHave.map((item) => <li key={item}>{item}</li>)}</ul></div>
      {!!role.niceToHave.length && <div><small className="dash-label">Nice-to-have</small><ul className="tags">{role.niceToHave.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {!!role.interestTags.length && <div><small className="dash-label">Interest tags</small><ul className="tags">{role.interestTags.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </article>)}</div> : <div className="dash-empty"><strong>No roles defined</strong><span>Add your first role to get started.</span></div>}

    {editing && <DashDialog className="dash-dialog-modal" labelledBy="role-form-title" onClose={() => setEditing(null)}>
      <section className="dash-modal">
        <div className="dash-modal-head"><div><span className="dash-kicker">Project setup</span><h2 id="role-form-title">{roles.some((role) => role.id === editing.id) ? "Edit role" : "Add a role"}</h2></div>
          <button className="dash-icon-button" type="button" aria-label="Close role form" onClick={() => setEditing(null)}>×</button></div>
        <form className="dash-form" onSubmit={submit}>
          <label>Role name<input name="name" required maxLength={90} defaultValue={editing.name} placeholder="e.g. Product research" /></label>
          <label>What will this person do?<textarea name="description" required rows={3} maxLength={500} defaultValue={editing.description} placeholder="Describe the work and expected outcomes." /></label>
          <label>Openings<input name="openings" type="number" required min={1} max={25} defaultValue={editing.openings} /></label>
          <label>Must-have skills <span className="optional">comma-separated</span><input name="mustHave" defaultValue={editing.mustHave.join(", ")} placeholder="Research, interviewing" /></label>
          <label>Nice-to-have skills <span className="optional">comma-separated</span><input name="niceToHave" defaultValue={editing.niceToHave.join(", ")} placeholder="Figma, analytics" /></label>
          <label>Interest tags <span className="optional">comma-separated</span><input name="interestTags" defaultValue={editing.interestTags.join(", ")} placeholder="Startups, design" /></label>
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          <div className="row wrap end"><button className="button button-secondary" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="button" type="submit">Save role</button></div>
        </form>
      </section>
    </DashDialog>}
  </section>;
}
