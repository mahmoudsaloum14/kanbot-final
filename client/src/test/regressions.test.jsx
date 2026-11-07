import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import { Toast } from "../hooks/workspace.js";
import {
  Assistant,
  GenerateDialog,
  PlanDialog,
} from "../features/assistant.jsx";
import { CompleteDialog, SprintDialog } from "../features/sprintForms.jsx";
import { Board } from "../features/board.jsx";
import { Backlog } from "../features/backlog.jsx";
import { TodoDialog } from "../features/todos.jsx";
import { Dialog } from "../components/ui.jsx";
import {
  SummaryPanel,
  StartSprintDialog,
} from "../components/SprintActions.jsx";
import { moveBoard } from "../lib/board.js";
import { get, post } from "../api/client.js";
vi.mock("../api/client.js", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
const notify = vi.fn();
const task = {
  id: "t1",
  key: "KAN-1",
  title: "Build login",
  description: "",
  type: "task",
  priority: "medium",
  storyPoints: 3,
  status: "todo",
  sprintId: "s1",
  labels: [],
  dueDate: null,
};
const sprint = {
  id: "s1",
  name: "Sprint 1",
  status: "active",
  goal: "Ship login",
  startDate: "2026-11-01",
  endDate: "2026-11-15",
  stats: {
    totalTodos: 1,
    doneTodos: 0,
    totalPoints: 3,
    donePoints: 0,
    byStatus: { todo: 1, in_progress: 0, in_review: 0, done: 0 },
  },
};
const board = {
  sprint,
  columns: { todo: [task], in_progress: [], in_review: [], done: [] },
};
function wrap(ui) {
  return <Toast.Provider value={notify}>{ui}</Toast.Provider>;
}
function route(ui, path = "/projects/p1/board") {
  return render(
    wrap(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Outlet context={{ setAi: vi.fn() }} />}>
            <Route path="/projects/:projectId/board" element={ui} />
            <Route path="/projects/:projectId/backlog" element={ui} />
          </Route>
        </Routes>
      </MemoryRouter>,
    ),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ mode: "ai", model: "gemini-3.5-flash-lite" });
  post.mockResolvedValue({});
});
describe("AI regressions", () => {
  it("keeps conversation on drawer reopen and sends its full history", async () => {
    post.mockResolvedValue({
      message: { role: "assistant", content: "Start with login." },
    });
    const view = render(
      wrap(<Assistant open projectId="p1" onClose={() => {}} />),
    );
    fireEvent.change(screen.getByLabelText("Message to Kanbot"), {
      target: { value: "What first?" },
    });
    fireEvent.click(screen.getByText("Send"));
    await screen.findByText("Start with login.");
    view.rerender(
      wrap(<Assistant open={false} projectId="p1" onClose={() => {}} />),
    );
    view.rerender(wrap(<Assistant open projectId="p1" onClose={() => {}} />));
    expect(screen.getByText("Start with login.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message to Kanbot"), {
      target: { value: "Why?" },
    });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(post.mock.calls[1][1].messages).toHaveLength(3));
    expect(get).toHaveBeenCalledTimes(1);
  });
  it("calls the summary endpoint and offers retry after error", async () => {
    post
      .mockRejectedValueOnce(new Error("Quota reached"))
      .mockResolvedValueOnce({
        sprint: {
          ...sprint,
          summary: { content: "### Finished login", generatedAt: "2026-11-02" },
        },
      });
    const update = vi.fn();
    render(<SummaryPanel sprint={sprint} onUpdated={update} />);
    fireEvent.click(screen.getByText("Summarize"));
    await screen.findByText("Quota reached");
    fireEvent.click(screen.getByText("Try again"));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(post).toHaveBeenLastCalledWith("/sprints/s1/ai/summary", {});
  });
  it("saves only selected edited drafts and signals a refresh", async () => {
    const refresh = vi.fn();
    window.addEventListener("kanbot:changed", refresh);
    post
      .mockResolvedValueOnce({
        todos: [
          { title: "First", type: "task", priority: "medium", storyPoints: 3 },
          { title: "Second", type: "task", priority: "low", storyPoints: 1 },
        ],
      })
      .mockResolvedValueOnce({ todos: [] });
    render(wrap(<GenerateDialog projectId="p1" onClose={() => {}} />));
    fireEvent.change(screen.getByLabelText("Describe the feature"), {
      target: { value: "Login screen" },
    });
    fireEvent.click(screen.getByText("Generate"));
    const input = await screen.findByDisplayValue("First");
    fireEvent.change(input, { target: { value: "Edited first" } });
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Add 1 to backlog"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(post.mock.calls[1][1].todos).toEqual([
      {
        title: "Edited first",
        type: "task",
        priority: "medium",
        storyPoints: 3,
      },
    ]);
    window.removeEventListener("kanbot:changed", refresh);
  });
  it("requires confirmation for an AI plan and signals refresh after saving", async () => {
    const refresh = vi.fn();
    window.addEventListener("kanbot:changed", refresh);
    get.mockResolvedValue({ todos: [{ ...task, sprintId: null }] });
    post
      .mockResolvedValueOnce({
        goal: "Ship",
        todoIds: ["t1"],
        reasoning: "Focus",
      })
      .mockResolvedValueOnce({ sprint });
    render(wrap(<PlanDialog projectId="p1" onClose={() => {}} />));
    fireEvent.click(screen.getByText("Suggest plan"));
    await screen.findByText("Create sprint with 1 todos");
    expect(post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Create sprint with 1 todos"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(post).toHaveBeenLastCalledWith("/projects/p1/sprints", {
      goal: "Ship",
      todoIds: ["t1"],
    });
    window.removeEventListener("kanbot:changed", refresh);
  });
});
describe("Sprint lifecycle regressions", () => {
  it("completes once and proceeds to history even if AI summary fails", async () => {
    post
      .mockResolvedValueOnce({ sprint: { ...sprint, status: "completed" } })
      .mockRejectedValueOnce(new Error("AI timeout"));
    const done = vi.fn();
    render(
      wrap(
        <CompleteDialog
          sprint={sprint}
          sprints={[sprint]}
          onClose={() => {}}
          onDone={done}
        />,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Complete sprint" }));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    expect(
      post.mock.calls.filter(([p]) => p.endsWith("/complete")),
    ).toHaveLength(1);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Sprint completed. Summary failed"),
      "bad",
    );
  });
  it("omits a blank sprint name so the server generates the default", async () => {
    const saved = vi.fn();
    render(
      wrap(
        <SprintDialog projectId="p1" onClose={() => {}} onChanged={saved} />,
      ),
    );
    fireEvent.click(screen.getByText("Save sprint"));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(post.mock.calls[0][1].name).toBeUndefined();
  });
  it("sends chosen start and end dates", async () => {
    const started = vi.fn();
    render(
      <StartSprintDialog
        sprint={sprint}
        onClose={() => {}}
        onStarted={started}
      />,
    );
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-11-03" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-11-17" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start sprint" }));
    await waitFor(() => expect(started).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith("/sprints/s1/start", {
      startDate: "2026-11-03",
      endDate: "2026-11-17",
    });
  });
});
describe("Drag and rollback regressions", () => {
  it("updates progress without mutating the rollback snapshot", () => {
    const result = moveBoard(board, "t1", "done", 0);
    expect(result.sprint.stats.donePoints).toBe(3);
    expect(result.columns.done[0].status).toBe("done");
    expect(board.columns.todo).toHaveLength(1);
    expect(board.sprint.stats.donePoints).toBe(0);
  });
  it("sends exactly one move for a card drop and rolls back when offline", async () => {
    const second = { ...task, id: "t2", title: "Review", status: "done" };
    const initial = { ...board, columns: { ...board.columns, done: [second] } };
    get.mockImplementation((p) =>
      Promise.resolve(p.includes("/todos") ? initial : { sprints: [sprint] }),
    );
    post.mockRejectedValue(new Error("Offline"));
    route(<Board />);
    await screen.findByText("Build login");
    fireEvent.dragStart(screen.getByText("Build login").closest("article"));
    fireEvent.drop(screen.getByText("Review").closest("article"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Offline", "bad"));
    expect(post).toHaveBeenCalledTimes(1);
    expect(
      within(
        screen.getByRole("heading", { name: "To do 1" }).closest("section"),
      ).getByText("Build login"),
    ).toBeInTheDocument();
  });
  it("backlog reorder sends one request and restores its order on failure", async () => {
    const tasks = [
      { ...task, sprintId: null },
      { ...task, id: "t2", title: "Second", sprintId: null },
    ];
    get.mockImplementation((p) =>
      Promise.resolve(
        p.includes("/todos") ? { todos: tasks } : { sprints: [] },
      ),
    );
    post.mockRejectedValue(new Error("Offline"));
    route(<Backlog />, "/projects/p1/backlog");
    await screen.findByText("Build login");
    fireEvent.dragStart(screen.getByText("Second").closest("article"));
    fireEvent.drop(screen.getByText("Build login").closest("article"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Offline", "bad"));
    expect(post).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("article")[0]).toHaveTextContent("Build login");
  });
});
describe("Dialog regressions", () => {
  it("asks before closing an unsaved task and keeps changes when cancelled", () => {
    const close = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      wrap(
        <TodoDialog
          todo={task}
          sprints={[sprint]}
          onClose={close}
          onChanged={() => {}}
        />,
      ),
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Edited" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(window.confirm).toHaveBeenCalledWith("Discard changes?");
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toHaveValue("Edited");
  });
  it("opens a native modal dialog and handles Escape through cancel", () => {
    const close = vi.fn();
    render(
      <Dialog title="Test dialog" onClose={close}>
        <input aria-label="Test input" />
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("open");
    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(close).toHaveBeenCalledTimes(1);
  });
});
