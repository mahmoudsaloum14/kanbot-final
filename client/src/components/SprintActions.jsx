import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { post } from "../api/client.js";
import { Dialog, Field } from "./ui.jsx";

export function SummaryPanel({ sprint, onUpdated, id }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function generate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await post("/sprints/" + sprint.id + "/ai/summary", {});
      onUpdated(result.sprint);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="summary" id={id} aria-busy={busy}>
      <h3>AI sprint summary</h3>
      <button className="outline" onClick={generate} disabled={busy}>
        {busy
          ? "Generating…"
          : error
            ? "Try again"
            : sprint.summary
              ? "Regenerate"
              : "Summarize"}
      </button>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {sprint.summary ? (
        <>
          <ReactMarkdown>{sprint.summary.content}</ReactMarkdown>
          <small>
            Generated {new Date(sprint.summary.generatedAt).toLocaleString()}
          </small>
        </>
      ) : (
        <p>Generate a retrospective for this sprint.</p>
      )}
      <p className="hint">AI can make mistakes. Review before saving.</p>
    </section>
  );
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function StartSprintDialog({ sprint, onClose, onStarted }) {
  const [start, setStart] = useState(dateOffset(0)),
    [end, setEnd] = useState(dateOffset(14));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (end < start) {
      setError("End date must be on or after the start date");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/sprints/" + sprint.id + "/start", {
        startDate: start,
        endDate: end,
      });
      onStarted();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={"Start " + sprint.name} onClose={onClose} busy={busy}>
      <form className="form" onSubmit={submit}>
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        <Field label="Start date">
          <input
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            required
            min={start}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
        <div className="dialogActions">
          <button
            type="button"
            className="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Starting…" : "Start sprint"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
