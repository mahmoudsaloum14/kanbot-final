import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Sparkles, X } from "lucide-react";
import { get, post } from "../api/client.js";
import { useToast, changed } from "../hooks/workspace.js";
import { Dialog, Field } from "../components/ui.jsx";
import { SummaryPanel } from "../components/SprintActions.jsx";
export function Assistant({ open, onClose, projectId }) {
  const toast = useToast(),
    [messages, setMessages] = useState([]),
    [text, setText] = useState(""),
    [status, setStatus] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [summarySprint, setSummarySprint] = useState(null),
    [summaryLoading, setSummaryLoading] = useState(false);
  const [generate, setGenerate] = useState(false),
    [plan, setPlan] = useState(false);
  useEffect(() => {
    get("/ai/status")
      .then(setStatus)
      .catch((e) => toast(e.message, "bad"));
  }, [projectId, toast]);
  const send = async () => {
    if (!text.trim() || busy) return;
    if (messages.length >= 30) {
      toast("Start a new chat to continue.", "bad");
      return;
    }
    let next = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setText("");
    setBusy(true);
    setError("");
    try {
      let x = await post(`/projects/${projectId}/ai/chat`, { messages: next });
      if (!x?.message || typeof x.message.content !== "string") {
        throw new Error("The AI returned an invalid response. Try again.");
      }
      setMessages([...next, x.message]);
    } catch (e) {
      setMessages(messages);
      setText(text);
      setError(e.message);
      toast(e.message + " Try again.", "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {open && (
        <aside
          className="aiDrawer"
          aria-label="Kanbot assistant"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        >
          <div className="drawerHead">
            <div>
              <Sparkles />
              <b>Kanbot AI</b>
              {status?.mode === "mock" && <span className="mock">Mock AI</span>}
            </div>
            <button
              className="iconBtn"
              aria-label="Close assistant"
              onClick={onClose}
            >
              <X />
            </button>
          </div>
          <div className="aiActions">
            <button onClick={() => setGenerate(true)}>Create todos</button>
            <button onClick={() => setPlan(true)}>Plan sprint</button>
            <button
              disabled={summaryLoading}
              onClick={async () => {
                setSummaryLoading(true);
                try {
                  const result = await get(
                    "/projects/" + projectId + "/sprints",
                  );
                  const sprint =
                    result.sprints.find((s) => s.status === "active") ||
                    result.sprints.find((s) => s.status === "completed");
                  if (sprint) setSummarySprint(sprint);
                  else
                    toast("Start a sprint before generating a summary.", "bad");
                } catch (e) {
                  toast(e.message, "bad");
                } finally {
                  setSummaryLoading(false);
                }
              }}
            >
              {summaryLoading ? "Loading…" : "Summarize sprint"}
            </button>
          </div>
          <div className="messages">
            {!messages.length && (
              <div className="aiWelcome">
                <Bot />
                <h3>Your focused AI teammate</h3>
                <p>
                  Ask about the work, get a grounded answer, then review every
                  change before saving.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <article className={"message " + m.role} key={i}>
                {m.role === "assistant" ? (
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </article>
            ))}
            {busy && (
              <div className="thinking">
                <span className="orb" />
                Thinking…
              </div>
            )}
          </div>
          <div className="chatInput">
            <textarea
              aria-label="Message to Kanbot"
              maxLength={4000}
              placeholder="Ask Kanbot…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button className="primary" disabled={busy} onClick={send}>
              Send
            </button>
          </div>
          {error && (
            <div role="alert" className="alert">
              {error}
              <button disabled={busy} onClick={send}>
                Try again
              </button>
            </div>
          )}
          <p className="disclaimer">
            AI can make mistakes. Review before saving.
          </p>
          <button
            className="newChat"
            disabled={busy}
            onClick={() => setMessages([])}
          >
            New chat
          </button>
        </aside>
      )}
      {generate && (
        <GenerateDialog
          projectId={projectId}
          onClose={() => setGenerate(false)}
        />
      )}{" "}
      {plan && (
        <PlanDialog projectId={projectId} onClose={() => setPlan(false)} />
      )}
      {summarySprint && (
        <Dialog title="Sprint summary" onClose={() => setSummarySprint(null)}>
          <SummaryPanel
            sprint={summarySprint}
            onUpdated={(s) => {
              setSummarySprint(s);
              changed();
            }}
          />
        </Dialog>
      )}
    </>
  );
}
export function GenerateDialog({ projectId, onClose }) {
  const toast = useToast(),
    [prompt, setPrompt] = useState(""),
    [count, setCount] = useState(5),
    [drafts, setDrafts] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      let x = await post(`/projects/${projectId}/ai/generate-todos`, {
        prompt,
        count: Number(count),
      });
      if (!Array.isArray(x?.todos)) {
        throw new Error("The AI returned an invalid response. Try again.");
      }
      setDrafts(x.todos.map((t) => ({ ...t, keep: true })));
    } catch (e) {
      setError(e.message);
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (busy) return;
    let todos = drafts.filter((x) => x.keep).map(({ keep, ...x }) => x);
    if (!todos.length) return;
    setBusy(true);
    try {
      await post(`/projects/${projectId}/todos/bulk`, { todos });
      toast(`Added ${todos.length} todos to backlog`);
      changed();
      onClose();
    } catch (e) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Generate todos with AI"
      onClose={onClose}
      busy={busy}
      dirty={drafts.length > 0}
      wide
    >
      <div className="form">
        <Field label="Describe the feature">
          <textarea
            rows="4"
            maxLength={2000}
            placeholder="e.g. A profile page with avatar upload and privacy settings"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </Field>
        <div className="row">
          <Field label="Number of suggestions">
            <input
              type="number"
              min="1"
              max="10"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </Field>
          <button
            className="primary"
            disabled={
              busy ||
              prompt.trim().length < 3 ||
              !Number.isInteger(Number(count)) ||
              Number(count) < 1 ||
              Number(count) > 10
            }
            onClick={generate}
          >
            <Sparkles />
            Generate
          </button>
        </div>
        {error && (
          <p className="alert" role="alert">
            {error} <button disabled={busy} onClick={generate}>Try again</button>
          </p>
        )}
        {drafts.length > 0 && (
          <>
            <p className="hint">
              Review and edit every suggestion. Nothing is saved until you
              confirm.
            </p>
            <div className="drafts">
              {drafts.map((d, i) => (
                <div className="draft" key={i}>
                  <input
                    type="checkbox"
                    aria-label={`Include suggestion ${i + 1}`}
                    checked={d.keep}
                    onChange={(e) =>
                      setDrafts(
                        drafts.map((x, n) =>
                          n === i ? { ...x, keep: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={`Suggestion ${i + 1} title`}
                    maxLength={200}
                    value={d.title}
                    onChange={(e) =>
                      setDrafts(
                        drafts.map((x, n) =>
                          n === i ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <select
                    aria-label={`Suggestion ${i + 1} type`}
                    value={d.type}
                    onChange={(e) =>
                      setDrafts(
                        drafts.map((x, n) =>
                          n === i ? { ...x, type: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    {["task", "story", "bug"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`Suggestion ${i + 1} priority`}
                    value={d.priority}
                    onChange={(e) =>
                      setDrafts(
                        drafts.map((x, n) =>
                          n === i ? { ...x, priority: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    {["low", "medium", "high", "urgent"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`Suggestion ${i + 1} story points`}
                    value={d.storyPoints || ""}
                    onChange={(e) =>
                      setDrafts(
                        drafts.map((x, n) =>
                          n === i
                            ? {
                                ...x,
                                storyPoints: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 5, 8, 13].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="dialogActions">
              <span />
              <button
                className="outline"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Discard suggestions?")) onClose();
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  !drafts.some((d) => d.keep) ||
                  drafts.some((d) => d.keep && !d.title.trim())
                }
                onClick={save}
              >
                Add {drafts.filter((x) => x.keep).length} to backlog
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
export function PlanDialog({ projectId, onClose }) {
  const toast = useToast(),
    [capacity, setCapacity] = useState(20),
    [focus, setFocus] = useState(""),
    [plan, setPlan] = useState(null),
    [backlog, setBacklog] = useState([]),
    [picked, setPicked] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const suggest = async () => {
    setBusy(true);
    setError("");
    try {
      let [p, b] = await Promise.all([
        post(`/projects/${projectId}/ai/plan-sprint`, {
          capacity: Number(capacity),
          focus,
        }),
        get(`/projects/${projectId}/todos?sprintId=backlog`),
      ]);
      if (!p || !Array.isArray(p.todoIds) || typeof p.goal !== "string") {
        throw new Error("The AI returned an invalid response. Try again.");
      }
      setPlan(p);
      setBacklog(b.todos);
      setPicked(p.todoIds);
    } catch (e) {
      setError(e.message);
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await post(`/projects/${projectId}/sprints`, {
        goal: plan.goal,
        todoIds: picked,
      });
      toast("Planned sprint created");
      changed();
      onClose();
    } catch (e) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  let total = backlog
    .filter((t) => picked.includes(t.id))
    .reduce((n, t) => n + (t.storyPoints || 0), 0);
  return (
    <Dialog
      title="Plan sprint with AI"
      onClose={onClose}
      busy={busy}
      dirty={!!plan}
      wide
    >
      <div className="form">
        <div className="two">
          <Field label="Capacity (story points)">
            <input
              type="number"
              min="1"
              max="200"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </Field>
          <Field label="Focus (optional)">
            <input
              placeholder="e.g. onboarding experience"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            />
          </Field>
        </div>
        <button
          className="primary"
          disabled={
            busy ||
            !Number.isInteger(Number(capacity)) ||
            Number(capacity) < 1 ||
            Number(capacity) > 200
          }
          onClick={suggest}
        >
          <Sparkles />
          Suggest plan
        </button>
        {error && (
          <p className="alert" role="alert">
            {error} <button disabled={busy} onClick={suggest}>Try again</button>
          </p>
        )}
        {plan && (
          <>
            <Field label="Suggested sprint goal">
              <input
                value={plan.goal}
                onChange={(e) => setPlan({ ...plan, goal: e.target.value })}
              />
            </Field>
            <div className="planGrid">
              <div>
                <h3>
                  Selected work{" "}
                  <span className="points">
                    {total}/{capacity} pts
                  </span>
                </h3>
                {backlog.map((t) => (
                  <label className="pick" key={t.id}>
                    <input
                      type="checkbox"
                      checked={picked.includes(t.id)}
                      onChange={(e) =>
                        setPicked(
                          e.target.checked
                            ? [...picked, t.id]
                            : picked.filter((x) => x !== t.id),
                        )
                      }
                    />
                    <b>{t.key}</b>
                    <span>{t.title}</span>
                    <em>{t.storyPoints ?? "—"} pts</em>
                  </label>
                ))}
              </div>
              <div className="reason">
                <h3>Why this plan</h3>
                <p>{plan.reasoning}</p>
              </div>
            </div>
            <div className="dialogActions">
              <span />
              <button
                className="outline"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Discard sprint plan?")) onClose();
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={busy || total > capacity}
                onClick={create}
              >
                Create sprint with {picked.length} todos
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
