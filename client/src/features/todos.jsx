import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { post, patch, del } from "../api/client.js";
import { useToast, changed } from "../hooks/workspace.js";
import { Dialog, Field } from "../components/ui.jsx";
import { Select } from "./sprintForms.jsx";
export function TodoRow({
  todo,
  sprints = [],
  onOpen,
  onMove,
  draggable,
  onDragStart,
  onDrop,
}) {
  return (
    <article
      className="todoRow"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop?.();
      }}
    >
      <span className="drag" aria-hidden="true">
        ⠿
      </span>
      <b>{todo.key}</b>
      <button className="todoTitle" onClick={onOpen}>
        {todo.title}
        {todo.labels?.length > 0 && <small>{todo.labels.join(" · ")}</small>}
      </button>
      <span className="badge type">{todo.type}</span>
      <span className={"badge " + todo.priority}>{todo.priority}</span>
      <span className="points">{todo.storyPoints ?? "—"} pts</span>
      {onMove && (
        <select
          className="moveSelect"
          aria-label={"Move " + todo.key}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v === "top" || v === "bottom")
              onMove(
                todo.id,
                todo.sprintId,
                todo.status,
                v === "top" ? 0 : 999,
              );
            else onMove(todo.id, v === "backlog" ? null : v, todo.status, 999);
          }}
        >
          <option value="" disabled>
            Move…
          </option>
          <option value="top">Move to top</option>
          <option value="bottom">Move to bottom</option>
          <option value="backlog">Backlog</option>
          {sprints
            .filter((x) => x.status !== "completed")
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      )}
    </article>
  );
}
export function QuickCreate({ projectId, onCreated }) {
  const [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false),
    toast = useToast();
  const add = async (e) => {
    if (e.key === "Escape") return setTitle("");
    if (e.key !== "Enter" || !title.trim() || busy) return;
    setBusy(true);
    try {
      await post(`/projects/${projectId}/todos`, { title: title.trim() });
      setTitle("");
      onCreated();
      changed();
      toast("Todo created");
    } catch (e) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="quick">
      <Plus size={17} />
      <input
        aria-label="Quick create todo"
        readOnly={busy}
        maxLength={200}
        placeholder="Create a todo — press Enter"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={add}
      />
    </div>
  );
}
export function TodoDialog({ todo, sprints, onClose, onChanged }) {
  const [f, setF] = useState({ ...todo, labels: todo.labels.join(", ") }),
    [busy, setBusy] = useState(false),
    [errors, setErrors] = useState({}),
    toast = useToast();
  const completed = sprints.some(
    (s) => s.id === todo.sprintId && s.status === "completed",
  );
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErrors({});
    setBusy(true);
    try {
      await patch("/todos/" + todo.id, {
        ...f,
        storyPoints: f.storyPoints ? Number(f.storyPoints) : null,
        labels: f.labels
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      });
      onChanged();
      changed();
      toast("Todo updated");
      onClose();
    } catch (e) {
      setErrors(
        Object.fromEntries((e.details || []).map((d) => [d.path, d.message])),
      );
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (busy) return;
    if (confirm(`Delete ${todo.key}?`)) {
      setBusy(true);
      try {
        await del("/todos/" + todo.id);
        changed();
        onChanged();
        toast("Todo deleted");
        onClose();
      } catch (e) {
        toast(e.message, "bad");
      } finally {
        setBusy(false);
      }
    }
  };
  return (
    <Dialog
      title={`${todo.key} · Todo details`}
      onClose={onClose}
      busy={busy}
      dirty={
        JSON.stringify(f) !==
        JSON.stringify({ ...todo, labels: todo.labels.join(", ") })
      }
      wide
    >
      <form className="todoForm" onSubmit={save}>
        <div className="mainFields">
          <Field label="Title" error={errors.title}>
            <input
              required
              maxLength={200}
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </Field>
          <Field label="Description" error={errors.description}>
            <textarea
              rows="9"
              maxLength={5000}
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </Field>
          <Field label="Labels (comma-separated)" error={errors.labels}>
            <input
              value={f.labels}
              onChange={(e) => setF({ ...f, labels: e.target.value })}
            />
          </Field>
        </div>
        <div className="sideFields">
          <Select
            label="Status"
            disabled={completed}
            error={errors.status}
            value={f.status}
            values={["todo", "in_progress", "in_review", "done"]}
            onChange={(v) => setF({ ...f, status: v })}
          />
          <Select
            label="Priority"
            value={f.priority}
            values={["low", "medium", "high", "urgent"]}
            onChange={(v) => setF({ ...f, priority: v })}
          />
          <Select
            label="Type"
            value={f.type}
            values={["task", "story", "bug"]}
            onChange={(v) => setF({ ...f, type: v })}
          />
          <Select
            label="Story points"
            value={f.storyPoints || ""}
            values={["", 1, 2, 3, 5, 8, 13]}
            onChange={(v) => setF({ ...f, storyPoints: v })}
          />
          <Select
            label="Sprint"
            disabled={completed}
            error={errors.sprintId}
            value={f.sprintId || ""}
            values={[
              "",
              ...sprints
                .filter(
                  (s) => s.status !== "completed" || s.id === todo.sprintId,
                )
                .map((s) => s.id),
            ]}
            names={[
              "Backlog",
              ...sprints
                .filter(
                  (s) => s.status !== "completed" || s.id === todo.sprintId,
                )
                .map((s) => s.name),
            ]}
            onChange={(v) => setF({ ...f, sprintId: v || null })}
          />
          <Field label="Due date" error={errors.dueDate}>
            <input
              type="date"
              value={f.dueDate || ""}
              onChange={(e) => setF({ ...f, dueDate: e.target.value || null })}
            />
          </Field>
        </div>
        <div className="dialogActions full">
          <button
            type="button"
            className="dangerText"
            disabled={busy}
            onClick={remove}
          >
            <Trash2 size={16} />
            Delete
          </button>
          <span />
          <button
            type="button"
            className="outline"
            disabled={busy}
            onClick={() => {
              if (
                JSON.stringify(f) ===
                  JSON.stringify({ ...todo, labels: todo.labels.join(", ") }) ||
                confirm("Discard changes?")
              )
                onClose();
            }}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
