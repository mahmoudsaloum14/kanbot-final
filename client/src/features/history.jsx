import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { get } from "../api/client.js";
import { useToast, useRefresh } from "../hooks/workspace.js";
import { Loading, Empty, Status, Metric } from "../components/states.jsx";
import { TodoDialog, TodoRow } from "./todos.jsx";
import { SummaryPanel } from "../components/SprintActions.jsx";
export function Sprints() {
  const { projectId, sprintId } = useParams(),
    nav = useNavigate(),
    toast = useToast();
  const [sprints, setSprints] = useState([]),
    [board, setBoard] = useState(null),
    [selected, setSelected] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    return get("/projects/" + projectId + "/sprints")
      .then(async (x) => {
        setSprints(x.sprints);
        const chosen =
          x.sprints.find((s) => s.id === sprintId) ||
          (!sprintId &&
            (x.sprints.find((s) => s.status === "completed") || x.sprints[0]));
        if (sprintId && !chosen) throw new Error("Sprint not found");
        setBoard(chosen ? await get("/sprints/" + chosen.id + "/todos") : null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, sprintId]);
  useEffect(() => {
    load();
  }, [load]);
  useRefresh(load);
  const chosen = board?.sprint,
    st = chosen?.completedStats || chosen?.stats;
  return (
    <main className="content">
      <div className="pageTitle">
        <div>
          <h1>Sprint history</h1>
          <p>Look back clearly. Plan the next one wiser.</p>
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <div role="alert">
          {error}
          <button onClick={load}>Try again</button>
        </div>
      ) : !sprints.length ? (
        <Empty
          title="No sprints yet"
          body="Plan your first sprint from the backlog."
          action={() => nav("/projects/" + projectId + "/backlog")}
          label="Go to backlog"
        />
      ) : (
        <div className="history">
          <section className="sprintNav">
            {sprints.map((s) => {
              const stats = s.completedStats || s.stats;
              return (
                <button
                  className={chosen?.id === s.id ? "selected" : ""}
                  key={s.id}
                  onClick={() =>
                    nav("/projects/" + projectId + "/sprints/" + s.id)
                  }
                >
                  <b>{s.name}</b>
                  <Status s={s.status} />
                  <small>
                    {s.startDate || "Not scheduled"} →{" "}
                    {s.endDate || "Not scheduled"} · {stats.donePoints}/
                    {stats.totalPoints} pts
                  </small>
                </button>
              );
            })}
          </section>
          {chosen && (
            <section className="sprintDetail">
              <h2>
                {chosen.name} <Status s={chosen.status} />
              </h2>
              <p>{chosen.goal || "No sprint goal"}</p>
              <div className="metricGrid">
                <Metric
                  label="Completed todos"
                  value={st.doneTodos + "/" + st.totalTodos}
                />
                <Metric
                  label="Points done"
                  value={st.donePoints + "/" + st.totalPoints}
                />
                <Metric label="Carried over" value={st.carriedOver ?? 0} />
                <Metric
                  label="Completion"
                  value={
                    (st.totalPoints
                      ? Math.round((st.donePoints / st.totalPoints) * 100)
                      : 0) + "%"
                  }
                />
              </div>
              {chosen.status !== "planned" && (
                <SummaryPanel
                  key={chosen.id}
                  sprint={chosen}
                  onUpdated={(sprint) => {
                    setBoard((previous) => ({ ...previous, sprint }));
                    toast("Sprint summary generated");
                  }}
                />
              )}
              <section className="completedTasks">
                <h3>Tasks ({Object.values(board.columns).flat().length})</h3>
                {Object.values(board.columns)
                  .flat()
                  .map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      onOpen={() => setSelected(t)}
                    />
                  ))}
              </section>
            </section>
          )}
        </div>
      )}
      {selected && (
        <TodoDialog
          todo={selected}
          sprints={sprints}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </main>
  );
}
