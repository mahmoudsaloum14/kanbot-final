import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LayoutDashboard, Check, Sparkles } from "lucide-react";
import { get, post } from "../api/client.js";
import { useToast, useRefresh, changed } from "../hooks/workspace.js";
import { Loading, Empty, Status } from "../components/states.jsx";
import { TodoDialog } from "./todos.jsx";
import { CompleteDialog } from "./sprintForms.jsx";
import { SummaryPanel } from "../components/SprintActions.jsx";
import { moveBoard } from "../lib/board.js";
export function Board() {
  const { projectId } = useParams(),
    nav = useNavigate(),
    toast = useToast(),
    moving = useRef(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [data, setData] = useState(null),
    [sprints, setSprints] = useState([]),
    [selected, setSelected] = useState(null),
    [complete, setComplete] = useState(false),
    [drag, setDrag] = useState(null);
  const load = useCallback(() => {
    setError("");
    return get(`/projects/${projectId}/sprints`)
      .then((x) => {
        setSprints(x.sprints);
        let a = x.sprints.find((s) => s.status === "active");
        return a ? get("/sprints/" + a.id + "/todos") : null;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => {
    load();
  }, [load]);
  useRefresh(load);
  if (loading) return <Loading />;
  if (error)
    return (
      <main className="content">
        <p role="alert">{error}</p>
        <button onClick={load}>Try again</button>
      </main>
    );
  if (!data)
    return (
      <main className="content">
        <Empty
          icon={<LayoutDashboard />}
          title="No active sprint"
          body="Plan work in your backlog, then start a sprint when you are ready to focus."
          action={() => nav(`/projects/${projectId}/backlog`)}
          label="Go to backlog"
        />
      </main>
    );
  let s = data.sprint,
    st = s.stats,
    pct = st.totalPoints
      ? Math.round((st.donePoints / st.totalPoints) * 100)
      : 0;
  const daysRemaining = s.endDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(`${s.endDate}T00:00:00`).getTime() -
            new Date(new Date().toDateString()).getTime()) /
            86_400_000,
        ),
      )
    : null;
  const move = async (id, status, pos) => {
    if (moving.current || !id) return;
    moving.current = true;
    setDrag(null);
    const snapshot = data;
    setData(moveBoard(data, id, status, pos));
    try {
      await post("/todos/" + id + "/move", { status, position: pos });
      toast("Task moved");
      changed();
    } catch (e) {
      setData(snapshot);
      toast(e.message, "bad");
    } finally {
      moving.current = false;
    }
  };
  return (
    <>
      <main className="content">
        <div className="sprintHero">
          <div>
            <p className="eyebrow">ACTIVE SPRINT</p>
            <h1>
              {s.name} <Status s="active" />
            </h1>
            <p>
              {s.goal || "No sprint goal"} · {s.startDate || "Today"} →{" "}
              {s.endDate || "Open ended"}
              {daysRemaining !== null && ` · ${daysRemaining} days remaining`}
            </p>
            <div className="progress">
              <i style={{ width: pct + "%" }} />
            </div>
            <small>
              {st.doneTodos}/{st.totalTodos} todos · {st.donePoints}/
              {st.totalPoints} points done
            </small>
          </div>
          <div className="row">
            <a className="outline" href="#board-summary">
              <Sparkles />
              Sprint summary
            </a>
            <button className="primary" onClick={() => setComplete(true)}>
              <Check />
              Complete sprint
            </button>
          </div>
        </div>
        <SummaryPanel
          sprint={s}
          id="board-summary"
          onUpdated={(updated) =>
            setData((prev) => ({ ...prev, sprint: updated }))
          }
        />
        <div className="board">
          {[
            ["todo", "To do"],
            ["in_progress", "In progress"],
            ["in_review", "In review"],
            ["done", "Done"],
          ].map(([key, label]) => (
            <section
              className="column"
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (drag) move(drag, key, data.columns[key].length);
              }}
            >
              <h3>
                {label} <span>{data.columns[key].length}</span>
              </h3>
              {data.columns[key].map((t, i) => (
                <article
                  className="boardCard"
                  draggable
                  onDragStart={() => setDrag(t.id)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (drag && drag !== t.id) move(drag, key, i);
                  }}
                  onClick={() => setSelected(t)}
                  key={t.id}
                >
                  <b>{t.key}</b>
                  <h4>
                    <button
                      className="todoTitle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(t);
                      }}
                    >
                      {t.title}
                    </button>
                  </h4>
                  <div>
                    <span className="badge type">{t.type}</span>
                    <span className={"badge " + t.priority}>{t.priority}</span>
                    <span className="points">{t.storyPoints ?? "—"} pts</span>
                  </div>
                  <select
                    aria-label="Move task"
                    value={t.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => move(t.id, e.target.value, 999)}
                  >
                    {[
                      ["todo", "To do"],
                      ["in_progress", "In progress"],
                      ["in_review", "In review"],
                      ["done", "Done"],
                    ].map((x) => (
                      <option value={x[0]} key={x[0]}>
                        {x[1]}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </section>
          ))}
        </div>
      </main>
      {selected && (
        <TodoDialog
          todo={selected}
          sprints={sprints}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}{" "}
      {complete && (
        <CompleteDialog
          sprint={s}
          sprints={sprints}
          onClose={() => setComplete(false)}
          onDone={() => {
            setComplete(false);
            nav(`/projects/${projectId}/sprints/${s.id}`);
          }}
        />
      )}
    </>
  );
}
