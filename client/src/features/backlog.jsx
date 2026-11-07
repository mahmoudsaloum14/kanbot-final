import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { Plus, Search, Sparkles, ClipboardList } from "lucide-react";
import { get, post, del } from "../api/client.js";
import { useToast, useRefresh, changed } from "../hooks/workspace.js";
import { Loading, Empty, Status } from "../components/states.jsx";
import { TodoRow, QuickCreate, TodoDialog } from "./todos.jsx";
import { SprintDialog } from "./sprintForms.jsx";
import { StartSprintDialog } from "../components/SprintActions.jsx";
const useOutlet = useOutletContext;
const stat = (items) => ({
  count: items.length,
  points: items.reduce((n, t) => n + (t.storyPoints || 0), 0),
});
export function Backlog() {
  const { projectId } = useParams(),
    { setAi } = useOutlet(),
    nav = useNavigate(),
    toast = useToast(),
    [starting, setStarting] = useState(null),
    moving = useRef(false),
    [todos, setTodos] = useState([]),
    [sprints, setSprints] = useState([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState({ q: "", priority: "", type: "" }),
    [selected, setSelected] = useState(null),
    [sprintDlg, setSprintDlg] = useState(null),
    [drag, setDrag] = useState(null);
  const load = useCallback(() => {
    setBusy(true);
    setError("");
    Promise.all([
      get(`/projects/${projectId}/todos?sprintId=backlog`),
      get(`/projects/${projectId}/sprints`),
    ])
      .then(([t, s]) => {
        setTodos(t.todos);
        setSprints(s.sprints);
      })
      .catch((e) => {
        setError(e.message);
        toast(e.message, "bad");
      })
      .finally(() => setBusy(false));
  }, [projectId, toast]);
  useEffect(load, [load]);
  useRefresh(load);
  let filtered = todos.filter(
    (t) =>
      (!filter.q ||
        (t.key + t.title + t.description + t.labels.join(" "))
          .toLowerCase()
          .includes(filter.q.toLowerCase())) &&
      (!filter.priority || t.priority === filter.priority) &&
      (!filter.type || t.type === filter.type),
  );
  let totals = stat(todos);
  const move = async (todoId, sprintId, status, position = 999) => {
    if (moving.current) return;
    moving.current = true;
    const snapshot = todos;
    const task = todos.find((t) => t.id === todoId);
    setDrag(null);
    if (task) {
      const list = todos.filter((t) => t.id !== todoId);
      if (sprintId === null)
        list.splice(Math.min(position, list.length), 0, {
          ...task,
          status: status ?? task.status,
        });
      setTodos(list);
    }
    try {
      await post("/todos/" + todoId + "/move", {
        sprintId,
        ...(status ? { status } : {}),
        position,
      });
      changed();
      toast("Task moved");
    } catch (e) {
      setTodos(snapshot);
      toast(e.message, "bad");
    } finally {
      moving.current = false;
    }
  };
  return (
    <>
      <main className="content">
        <div className="pageTitle">
          <div>
            <h1>
              Backlog{" "}
              <span>
                {totals.count} todos · {totals.points} pts
              </span>
            </h1>
            <p>Shape the work before it reaches your sprint.</p>
          </div>
          <div className="row">
            <button className="outline" onClick={() => setAi(true)}>
              <Sparkles />
              Generate with AI
            </button>
            <button className="primary" onClick={() => setSprintDlg({})}>
              <Plus />
              Create sprint
            </button>
          </div>
        </div>
        <div className="filters">
          <div className="search">
            <Search />
            <input
              placeholder="Search tasks…"
              value={filter.q}
              onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            />
          </div>
          <select
            value={filter.priority}
            onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
          >
            <option value="">All priorities</option>
            {["low", "medium", "high", "urgent"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          >
            <option value="">All types</option>
            {["task", "story", "bug"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        {busy ? (
          <Loading />
        ) : error ? (
          <section className="empty" role="alert">
            <h2>Backlog could not be loaded</h2>
            <p>{error}</p>
            <button className="primary" onClick={load}>
              Try again
            </button>
          </section>
        ) : (
          <>
            {sprints
              .filter((s) => s.status === "planned")
              .map((s) => (
                <SprintSection
                  key={s.id}
                  sprint={s}
                  projectId={projectId}
                  onEdit={() => setSprintDlg(s)}
                  onStart={() => setStarting(s)}
                  active={sprints.some((x) => x.status === "active")}
                  onChanged={load}
                  onTodo={setSelected}
                  onMove={move}
                  sprints={sprints}
                />
              ))}
          </>
        )}
        {!error && <section
          className="taskList"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (drag && !filter.q && !filter.priority && !filter.type)
              move(drag, null, undefined, todos.length);
          }}
        >
          <div className="listHead">
            <h2>Backlog</h2>
            <span>
              {filtered.length} shown{" "}
              {filter.q || filter.priority || filter.type
                ? "· Reordering is disabled while filtering"
                : ""}
            </span>
          </div>
          {!busy && !filtered.length ? (
            <Empty
              icon={<ClipboardList />}
              title="Your backlog is empty"
              body="Add a focused todo or let your AI teammate draft a starting point."
              action={() => setAi(true)}
              label="Generate todos with AI"
            />
          ) : (
            filtered.map((t, i) => (
              <TodoRow
                key={t.id}
                todo={t}
                sprints={sprints}
                onOpen={() => setSelected(t)}
                onMove={move}
                draggable={!filter.q && !filter.priority && !filter.type}
                onDragStart={() => setDrag(t.id)}
                onDrop={() =>
                  drag && drag !== t.id && move(drag, null, undefined, i)
                }
              />
            ))
          )}
          <QuickCreate projectId={projectId} onCreated={load} />
        </section>}
      </main>
      {selected && (
        <TodoDialog
          todo={selected}
          sprints={sprints}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}{" "}
      {starting && (
        <StartSprintDialog
          sprint={starting}
          onClose={() => setStarting(null)}
          onStarted={() => {
            setStarting(null);
            changed();
            nav("/projects/" + projectId + "/board");
          }}
        />
      )}{" "}
      {sprintDlg && (
        <SprintDialog
          sprint={sprintDlg.id ? sprintDlg : null}
          projectId={projectId}
          onClose={() => setSprintDlg(null)}
          onChanged={() => {
            setSprintDlg(null);
            load();
          }}
        />
      )}
    </>
  );
}
export function SprintSection({
  sprint,
  projectId,
  onEdit,
  onStart,
  active,
  onChanged,
  onTodo,
  onMove,
  sprints,
}) {
  const [todos, setTodos] = useState([]),
    [open, setOpen] = useState(true),
    toast = useToast();
  useEffect(() => {
    get(`/projects/${projectId}/todos?sprintId=${sprint.id}`)
      .then((x) => setTodos(x.todos))
      .catch(() => {});
  }, [sprint.id, sprint.updatedAt, projectId]);
  const remove = async () => {
    if (confirm(`Delete ${sprint.name}? Its todos return to backlog.`)) {
      try {
        await del("/sprints/" + sprint.id);
        onChanged();
      } catch (e) {
        toast(e.message, "bad");
      }
    }
  };
  return (
    <section className="sprintSection">
      <div className="sprintHead" onClick={() => setOpen(!open)}>
        <div>
          <h2>
            {open ? "⌄" : "›"} {sprint.name}
            <Status s={sprint.status} />
          </h2>
          <p>
            {sprint.goal || "No sprint goal"} · {stat(todos).count} todos ·{" "}
            {stat(todos).points} pts
          </p>
        </div>
        <div className="row" onClick={(e) => e.stopPropagation()}>
          <button className="textBtn" onClick={onEdit}>
            Edit
          </button>
          <button className="textBtn dangerText" onClick={remove}>
            Delete
          </button>
          <button
            className="primary"
            disabled={active}
            title={active ? "Complete the active sprint first" : ""}
            onClick={onStart}
          >
            Start sprint
          </button>
        </div>
      </div>
      {open &&
        todos.map((t) => (
          <TodoRow
            key={t.id}
            todo={t}
            onOpen={() => onTodo(t)}
            onMove={onMove}
            sprints={sprints}
          />
        ))}
    </section>
  );
}
