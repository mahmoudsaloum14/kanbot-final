import { useState, useEffect, useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Plus,
  Search,
  MoreHorizontal,
  FolderKanban,
  Trash2,
} from "lucide-react";
import { get, post, patch, del } from "../api/client.js";
import { useToast } from "../hooks/workspace.js";
import { Dialog, Field } from "../components/ui.jsx";
import { Loading, Empty } from "../components/states.jsx";
const useOutlet = useOutletContext;
export function Projects() {
  const { projects, setProjects } = useOutlet(),
    nav = useNavigate(),
    toast = useToast(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState(null),
    [search, setSearch] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    get("/projects")
      .then((x) => setProjects(x.projects))
      .catch((e) => {
        setError(e.message);
        toast(e.message, "bad");
      })
      .finally(() => setLoading(false));
  }, [setProjects, toast]);
  useEffect(load, [load]);
  const shown = projects.filter((p) =>
    (p.name + p.key + p.description)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <main className="content">
      <div className="pageTitle">
        <div>
          <h1>Your projects</h1>
          <p>Spaces for every idea worth shipping.</p>
        </div>
        <button className="primary" onClick={() => setDialog({})}>
          <Plus />
          New project
        </button>
      </div>
      <div className="search">
        <Search />
        <input
          aria-label="Search projects"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <section className="empty" role="alert">
          <h2>Projects could not be loaded</h2>
          <p>{error}</p>
          <button className="primary" onClick={load}>
            Try again
          </button>
        </section>
      ) : shown.length ? (
        <div className="projectGrid">
          {shown.map((p) => (
            <article
              className="projectCard"
              key={p.id}
              onClick={() => nav(`/projects/${p.id}/backlog`)}
            >
              <div className="projectIcon">{p.key.slice(0, 2)}</div>
              <div className="cardMenu">
                <button
                  aria-label={`Edit ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialog(p);
                  }}
                >
                  <MoreHorizontal />
                </button>
              </div>
              <h3>
                <button
                  className="projectTitle"
                  onClick={(e) => {
                    e.stopPropagation();
                    nav(`/projects/${p.id}/backlog`);
                  }}
                >
                  {p.name}
                </button>
              </h3>
              <span className="key">{p.key}</span>
              <p>{p.description || "No description yet — make it yours."}</p>
              <footer>
                <span>{p.stats.backlogCount} backlog</span>
                <span>
                  {p.stats.activeSprint
                    ? `${p.stats.activeSprint.name} active`
                    : "No active sprint"}
                </span>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<FolderKanban />}
          title={search ? "No matching projects" : "Your workspace is waiting"}
          body={
            search
              ? "Try another project name or key."
              : "Create your first project to turn ideas into calm, focused progress."
          }
          action={() => setDialog({})}
          label="Create your first project"
        />
      )}
      {dialog && (
        <ProjectDialog
          project={dialog.id ? dialog : null}
          onClose={() => setDialog(null)}
          onSaved={(p) => {
            setDialog(null);
            load();
            toast(dialog.id ? "Project updated" : "Project created");
            if (!dialog.id) nav(`/projects/${p.id}/backlog`);
          }}
          onDelete={async (p) => {
            if (
              confirm(
                `Delete ${p.name}? This permanently deletes all todos and sprints.`,
              )
            ) {
              await del("/projects/" + p.id);
              toast("Project deleted");
              setDialog(null);
              load();
            }
          }}
        />
      )}
    </main>
  );
}
export function ProjectDialog({ project, onClose, onSaved, onDelete }) {
  const [f, setF] = useState(project || { name: "", key: "", description: "" }),
    [err, setErr] = useState({}),
    [busy, setBusy] = useState(false);
  const dirty =
    JSON.stringify(f) !==
    JSON.stringify(project || { name: "", key: "", description: "" });
  const close = () => {
    if (!busy && (!dirty || window.confirm("Discard changes?"))) onClose();
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete(project);
    } catch (e) {
      setErr({ form: e.message });
    } finally {
      setBusy(false);
    }
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      let x = project
        ? await patch("/projects/" + project.id, f)
        : await post(
            "/projects",
            Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")),
          );
      onSaved(x.project);
    } catch (e) {
      setErr({
        ...Object.fromEntries(
          (e.details || []).map((d) => [d.path, d.message]),
        ),
        form: e.message,
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={project ? "Edit project" : "Create project"}
      onClose={onClose}
      busy={busy}
      dirty={dirty}
    >
      <form onSubmit={save} className="form">
        {err.form && (
          <p className="alert" role="alert">
            {err.form}
          </p>
        )}
        <Field label="Project name" error={err.name}>
          <input
            required
            autoFocus
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Field>
        <Field label="Project key" error={err.key}>
          <input
            placeholder="Optional · e.g. KAN"
            maxLength="6"
            value={f.key}
            onChange={(e) =>
              setF({
                ...f,
                key: e.target.value.toUpperCase().replace(/[^A-Z]/g, ""),
              })
            }
          />
        </Field>
        <Field label="Description">
          <textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </Field>
        {project && (
          <p className="hint">
            Changing the key does not change existing todo keys.
          </p>
        )}
        <div className="dialogActions">
          {project && (
            <button
              type="button"
              className="dangerText"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 size={16} />
              Delete project
            </button>
          )}
          <span />
          <button
            type="button"
            className="outline"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save project"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
