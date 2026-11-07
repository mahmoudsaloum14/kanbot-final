import { useState } from "react";
import { post, patch } from "../api/client.js";
import { useToast, changed } from "../hooks/workspace.js";
import { Dialog, Field } from "../components/ui.jsx";
export function Select({
  label,
  value,
  values,
  names,
  onChange,
  disabled = false,
  error,
}) {
  return (
    <Field label={label} error={error}>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {values.map((x, i) => (
          <option value={x} key={x}>
            {names?.[i] ?? (x || "None")}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function SprintDialog({ sprint, projectId, onClose, onChanged }) {
  const [f, setF] = useState(
      sprint || { name: "", goal: "", startDate: "", endDate: "" },
    ),
    [busy, setBusy] = useState(false),
    toast = useToast();
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (f.startDate && f.endDate && f.endDate < f.startDate)
        throw new Error("End date must be on or after start date");
      let body = {
        name: f.name.trim() || undefined,
        goal: f.goal,
        startDate: f.startDate || null,
        endDate: f.endDate || null,
      };
      sprint
        ? await patch("/sprints/" + sprint.id, body)
        : await post(`/projects/${projectId}/sprints`, body);
      toast(sprint ? "Sprint updated" : "Sprint created");
      onChanged();
    } catch (e) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={sprint ? "Edit sprint" : "Create sprint"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Sprint name">
          <input
            placeholder="Sprint 1"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Field>
        <Field label="Goal">
          <textarea
            value={f.goal}
            onChange={(e) => setF({ ...f, goal: e.target.value })}
          />
        </Field>
        <div className="two">
          <Field label="Start date">
            <input
              type="date"
              value={f.startDate || ""}
              onChange={(e) => setF({ ...f, startDate: e.target.value })}
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={f.endDate || ""}
              onChange={(e) => setF({ ...f, endDate: e.target.value })}
            />
          </Field>
        </div>
        <div className="dialogActions">
          <span />
          <button type="button" className="outline" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save sprint"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function CompleteDialog({ sprint, sprints, onClose, onDone }) {
  const [target, setTarget] = useState("backlog"),
    [summary, setSummary] = useState(true),
    [busy, setBusy] = useState(false),
    toast = useToast();
  let st = sprint.stats;
  const done = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let x = await post(`/sprints/${sprint.id}/complete`, {
        moveUnfinishedTo: target,
      });
      if (summary) {
        try {
          await post(`/sprints/${sprint.id}/ai/summary`, {});
        } catch (e) {
          toast(
            "Sprint completed. Summary failed: " +
              e.message +
              " Retry from sprint history.",
            "bad",
          );
        }
      }
      changed();
      onDone(x.sprint);
    } catch (e) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={`Complete ${sprint.name}`} onClose={onClose} busy={busy}>
      <p>
        <b>{st.doneTodos} done</b>, {st.totalTodos - st.doneTodos} unfinished ·{" "}
        {st.donePoints}/{st.totalPoints} points completed.
      </p>
      <Select
        label="Move unfinished work to"
        value={target}
        values={[
          "backlog",
          ...sprints.filter((s) => s.status === "planned").map((s) => s.id),
        ]}
        names={[
          "Backlog",
          ...sprints.filter((s) => s.status === "planned").map((s) => s.name),
        ]}
        onChange={setTarget}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={summary}
          onChange={(e) => setSummary(e.target.checked)}
        />{" "}
        Generate AI summary after completing
      </label>
      <div className="dialogActions">
        <span />
        <button className="outline" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button className="primary" disabled={busy} onClick={done}>
          Complete sprint
        </button>
      </div>
    </Dialog>
  );
}
