import { beforeAll, afterAll, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
let server, directory, App;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "kanbot-client-test-"));
  process.env.DATA_FILE = join(directory, "db.json");
  process.env.NODE_ENV = "test";
  // This isolated regression test deliberately uses the supplied server's mock AI.
  // It never reads or changes server/.env or contacts Gemini.
  process.env.AI_API_KEY = "";
  const { createApp } = await import("../../../server/src/app.ts");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  vi.stubEnv("VITE_API_URL", `http://127.0.0.1:${server.address().port}/api`);
  App = (await import("../App.jsx")).default;
});
afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
it("registers, saves reviewed AI tasks, plans and completes a sprint against the real API", async () => {
  window.history.replaceState({}, "", "/register");
  render(<App />);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Regression Tester" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "regression@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "test-password-123" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "test-password-123" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Create account/ }));
  await screen.findByRole("heading", { name: "Your projects" });
  fireEvent.click(screen.getByRole("button", { name: /New project/ }));
  fireEvent.change(screen.getByLabelText("Project name"), {
    target: { value: "Regression Workspace" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save project" }));
  await screen.findByLabelText("Quick create todo");
  fireEvent.click(screen.getByRole("button", { name: "Ask AI" }));
  await screen.findByText("Mock AI");
  fireEvent.click(screen.getByRole("button", { name: "Create todos" }));
  fireEvent.change(screen.getByLabelText("Describe the feature"), {
    target: { value: "Build login; Validate login" },
  });
  fireEvent.change(screen.getByLabelText("Number of suggestions"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  await screen.findByDisplayValue("Build login");
  fireEvent.click(screen.getByRole("button", { name: "Add 2 to backlog" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Generate todos with AI" }),
    ).not.toBeInTheDocument(),
  );
  // These rows must appear through invalidation, without navigating or refreshing.
  await screen.findByRole("button", { name: "Build login" });
  fireEvent.click(screen.getByRole("button", { name: "Plan sprint" }));
  fireEvent.click(screen.getByRole("button", { name: "Suggest plan" }));
  await screen.findByRole("button", { name: "Create sprint with 2 todos" });
  fireEvent.click(
    screen.getByRole("button", { name: "Create sprint with 2 todos" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Plan sprint with AI" }),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Close assistant" }));
  fireEvent.click(await screen.findByRole("button", { name: "Start sprint" }));
  const start = screen.getByRole("dialog", { name: "Start Sprint 1" });
  fireEvent.click(within(start).getByRole("button", { name: "Start sprint" }));
  await screen.findByRole("heading", { name: "Sprint 1 active" });
  await screen.findByRole("button", { name: "Build login" });
  fireEvent.change(screen.getAllByLabelText("Move task")[0], {
    target: { value: "done" },
  });
  await waitFor(() =>
    expect(screen.getByText(/1\/2 todos/)).toBeInTheDocument(),
  );
  // Wait for persistence before starting the completion mutation.
  await screen.findByText("Task moved");
  fireEvent.click(screen.getByRole("button", { name: "Complete sprint" }));
  const complete = screen.getByRole("dialog", { name: "Complete Sprint 1" });
  fireEvent.click(
    within(complete).getByRole("button", { name: "Complete sprint" }),
  );
  await screen.findByRole("heading", { name: "Sprint history" });
  await screen.findByRole("heading", { name: /Sprint 1 completed/ });
  await screen.findByRole("heading", { name: "Highlights" });
  expect(screen.getByText("Carried over").parentElement).toHaveTextContent("1");
}, 20000);
