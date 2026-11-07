import { test, expect } from "@playwright/test";

const account = { name: "Browser Tester", email: "browser@example.test", password: "browser-password-123" };

function trackBrowserFailures(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function registerAndCreateProject(page, { name, email, project, key }) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: /^Password/ }).fill("browser-password-123");
  await page.getByLabel("Confirm password").fill("browser-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill(project);
  await page.getByLabel("Project key").fill(key);
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Backlog/ })).toBeVisible();
}

test.describe.serial("Kanbot browser workflow", () => {
  test("guards routes, registers, persists a session, and completes a manual sprint", async ({ page }) => {
    const errors = trackBrowserFailures(page);
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await page.getByRole("link", { name: "Create one" }).click();
    await page.getByLabel("Name").fill(account.name);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByLabel("Confirm password").fill(account.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();

    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Project name").fill("Browser Project");
    await page.getByLabel("Project key").fill("BRW");
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Backlog/ })).toBeVisible();

    const quick = page.getByLabel("Quick create todo");
    await quick.fill("First browser task");
    await quick.press("Enter");
    await quick.fill("Second browser task");
    await quick.press("Enter");
    await expect(page.getByRole("button", { name: "First browser task" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Second browser task" })).toBeVisible();

    await page.getByPlaceholder("Search tasks…").fill("Second");
    await expect(page.getByRole("button", { name: "Second browser task" })).toBeVisible();
    await expect(page.getByRole("button", { name: "First browser task" })).toBeHidden();
    await page.getByPlaceholder("Search tasks…").fill("");

    await page.getByRole("button", { name: "Create sprint" }).click();
    await page.getByLabel("Sprint name").fill("Browser Sprint");
    await page.getByRole("button", { name: "Save sprint" }).click();
    await expect(page.getByRole("heading", { level: 2, name: /Browser Sprint/ })).toBeVisible();

    await page.getByRole("button", { name: "First browser task" }).click();
    const detail = page.getByRole("dialog", { name: /Todo details/ });
    await detail.getByLabel("Sprint").selectOption({ label: "Browser Sprint" });
    await detail.getByLabel("Description").fill("Edited in a real browser.");
    await detail.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("button", { name: "Start sprint" }).click();
    await page.getByRole("dialog", { name: "Start Browser Sprint" }).getByRole("button", { name: "Start sprint" }).click();
    await expect(page.getByRole("heading", { name: /Browser Sprint.*active/ })).toBeVisible();

    await page.getByLabel("Move task").selectOption("done");
    await expect(page.getByText(/1\/1 todos/)).toBeVisible();
    await page.getByRole("button", { name: "Complete sprint" }).click();
    await page.getByRole("dialog", { name: "Complete Browser Sprint" }).getByRole("button", { name: "Complete sprint" }).click();
    await expect(page.getByRole("heading", { name: "Sprint history" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Sprint history" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("exercises mock AI, logout, expired-token protection, and responsive navigation", async ({ page }) => {
    const errors = trackBrowserFailures(page);
    await page.goto("/register");
    await page.getByLabel("Name").fill("AI Browser Tester");
    await page.getByLabel("Email").fill("browser-ai@example.test");
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByLabel("Confirm password").fill(account.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Project name").fill("AI Browser Project");
    await page.getByRole("button", { name: "Save project" }).click();
    await page.getByRole("button", { name: "Ask AI" }).click();
    await expect(page.getByText("Mock AI")).toBeVisible();
    await page.getByLabel("Message to Kanbot").fill("What should I work on next?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator(".message.assistant")).toBeVisible();
    await page.getByRole("button", { name: "Close assistant" }).click();

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.locator("aside")).toHaveCSS("width", "70px");
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByRole("button", { name: "Ask AI" })).toBeVisible();

    await page.getByTitle("Log out").click();
    await expect(page).toHaveURL(/\/login$/);
    await page.evaluate(() => localStorage.setItem("kanbot_token", "invalid-token"));
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await expect(page.getByText("Your session has expired. Please log in again.")).toBeVisible();
    expect(errors.filter((error) => !error.includes("401 (Unauthorized)"))).toEqual([]);
  });

  test.skip("covers auth validation, projects, keyboard flows, controlled AI failures, and responsive states", async ({ page }) => {
    const errors = trackBrowserFailures(page);
    const password = "browser-password-123";
    await page.goto("/register");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Name is required")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();

    await page.getByLabel("Name").fill("Acceptance Browser");
    await page.getByLabel("Email").fill("acceptance@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill("different-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Your workspace is waiting")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create your first project" })).toBeVisible();

    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Project name").fill("Acceptance Project");
    await page.getByLabel("Project key").fill("ACC");
    await page.getByLabel("Description").fill("Project listing proof");
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Backlog/ })).toBeVisible();
    const firstProjectUrl = page.url();

    const quick = page.getByLabel("Quick create todo");
    await quick.fill("Keyboard task one");
    await quick.press("Enter");
    await expect(quick).toBeFocused();
    await quick.fill("Temporary keyboard text");
    await quick.press("Escape");
    await expect(quick).toHaveValue("");
    await quick.fill("Keyboard task two");
    await quick.press("Enter");
    await expect(page.getByRole("button", { name: "Keyboard task two" })).toBeVisible();
    await page.getByLabel(/Move ACC-2/).selectOption("top");
    await expect(page.locator(".todoRow").first()).toContainText("Keyboard task two");

    await page.goto("/projects");
    await expect(page.getByText("Project listing proof")).toBeVisible();
    await expect(page.getByText("2 backlog")).toBeVisible();
    await page.getByLabel("Edit Acceptance Project").click();
    await expect(page.getByText("Changing the key does not change existing todo keys.")).toBeVisible();
    await page.getByLabel("Project key").fill("NEW");
    await page.getByRole("button", { name: "Save project" }).click();
    await page.getByRole("button", { name: "Acceptance Project" }).click();
    await expect(page.getByText("ACC-1")).toBeVisible();

    await page.goto("/projects");
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Project name").fill("Second Project");
    await page.getByLabel("Project key").fill("SEC");
    await page.getByRole("button", { name: "Save project" }).click();
    const secondProjectUrl = page.url();
    await page.getByLabel("Switch project").selectOption({ label: "NEW Â· Acceptance Project" });
    await expect(page).toHaveURL(firstProjectUrl);
    await page.reload();
    await expect(page.getByLabel("Switch project")).toHaveValue(firstProjectUrl.match(/projects\/([^/]+)/)[1]);
    await page.getByLabel("Switch project").selectOption({ label: "SEC Â· Second Project" });
    await expect(page).toHaveURL(secondProjectUrl);

    await page.setViewportSize({ width: 560, height: 850 });
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.locator("aside.mobileOpen")).toBeVisible();
    await page.setViewportSize({ width: 768, height: 850 });
    await expect(page.locator("aside")).toHaveCSS("width", "70px");
    await page.setViewportSize({ width: 1024, height: 850 });

    await page.getByRole("button", { name: "Ask AI" }).click();
    await expect(page.getByText("AI can make mistakes. Review before saving.")).toBeVisible();
    await page.route("**/api/projects/*/ai/chat", (route) => route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "AI_ERROR", message: "Controlled provider failure" } }),
    }));
    await page.getByLabel("Message to Kanbot").fill("Please fail safely");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("alert")).toContainText("Controlled provider failure");
    await page.unroute("**/api/projects/*/ai/chat");

    await page.getByRole("button", { name: "Create todos" }).click();
    await page.route("**/api/projects/*/ai/generate-todos", (route) => route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "RATE_LIMITED", message: "Controlled rate limit" } }),
    }));
    await page.getByLabel("Describe the feature").fill("A resilient error test");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByRole("alert")).toContainText("Controlled rate limit");
    await page.unroute("**/api/projects/*/ai/generate-todos");
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Plan sprint" }).click();
    await page.route("**/api/projects/*/ai/plan-sprint", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ goal: "Malformed" }),
    }));
    await page.getByRole("button", { name: "Suggest plan" }).click();
    await expect(page.getByRole("alert")).toContainText("invalid response");
    await page.unroute("**/api/projects/*/ai/plan-sprint");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Close assistant" }).click();

    await page.goto(firstProjectUrl);
    await page.getByRole("button", { name: "Keyboard task two" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Keyboard task two" })).toBeFocused();

    await page.route("**/api/projects/*/todos?sprintId=backlog", (route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Controlled backlog failure" } }),
    }));
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("Backlog could not be loaded");
    await page.unroute("**/api/projects/*/todos?sprintId=backlog");
    expect(errors.filter((error) => !error.includes("500 (Internal Server Error)") && !error.includes("502 (Bad Gateway)") && !error.includes("429 (Too Many Requests)"))).toEqual([]);
  });
});

test("browser auth, project edit/switch, and quick-create keyboard acceptance", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Name is required")).toBeVisible();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
  await page.getByLabel("Name").fill("Acceptance Browser");
  await page.getByLabel("Email").fill("acceptance@example.test");
  await page.getByRole("textbox", { name: /^Password/ }).fill("browser-password-123");
  await page.getByLabel("Confirm password").fill("different-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Passwords do not match")).toBeVisible();
  await page.getByLabel("Confirm password").fill("browser-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Create your first project" })).toBeVisible();

  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Acceptance Project");
  await page.getByLabel("Project key").fill("ACC");
  await page.getByLabel("Description").fill("Project listing proof");
  await page.getByRole("button", { name: "Save project" }).click();
  const firstProjectUrl = page.url();
  const quick = page.getByLabel("Quick create todo");
  await quick.fill("Keyboard task one");
  await quick.press("Enter");
  await expect(quick).toBeFocused();
  await quick.fill("Temporary keyboard text");
  await quick.press("Escape");
  await expect(quick).toHaveValue("");
  await quick.fill("Keyboard task two");
  await quick.press("Enter");
  await expect(page.getByRole("button", { name: "Keyboard task two" })).toBeVisible();
  await page.getByLabel(/Move ACC-2/).selectOption("top");
  await expect(page.locator(".todoRow").first()).toContainText("Keyboard task two");

  await page.goto("/projects");
  await expect(page.getByText("Project listing proof")).toBeVisible();
  await expect(page.getByText("2 backlog")).toBeVisible();
  await page.getByLabel("Edit Acceptance Project").click();
  await expect(page.getByText("Changing the key does not change existing todo keys.")).toBeVisible();
  await page.getByLabel("Project key").fill("NEW");
  await page.getByRole("button", { name: "Save project" }).click();
  await page.getByRole("button", { name: "Acceptance Project", exact: true }).click();
  await expect(page.getByText("ACC-1")).toBeVisible();
});

test("browser project switcher persists the selected project URL", async ({ page }) => {
  await registerAndCreateProject(page, { name: "Switcher", email: "switcher@example.test", project: "First Project", key: "ONE" });
  const firstProjectUrl = page.url();
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Second Project");
  await page.getByLabel("Project key").fill("SEC");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/backlog$/);
  const secondProjectUrl = page.url();
  await page.getByLabel("Switch project").selectOption(firstProjectUrl.match(/projects\/([^/]+)/)[1]);
  await expect(page).toHaveURL(firstProjectUrl);
  await page.reload();
  await expect(page.getByLabel("Switch project")).toHaveValue(firstProjectUrl.match(/projects\/([^/]+)/)[1]);
  await page.getByLabel("Switch project").selectOption(secondProjectUrl.match(/projects\/([^/]+)/)[1]);
  await expect(page).toHaveURL(secondProjectUrl);
});

test("browser controlled AI failure states and malformed responses", async ({ page }) => {
  await registerAndCreateProject(page, { name: "AI failures", email: "ai-errors@example.test", project: "AI Error Project", key: "AIE" });
  await page.getByRole("button", { name: "Ask AI" }).click();
  await expect(page.getByText("AI can make mistakes. Review before saving.")).toBeVisible();
  await page.route("**/api/projects/*/ai/chat", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: { message: "Controlled provider failure" } }) }));
  await page.getByLabel("Message to Kanbot").fill("Please fail safely");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("alert")).toContainText("Controlled provider failure");
  await page.unroute("**/api/projects/*/ai/chat");

  await page.getByRole("button", { name: "Create todos" }).click();
  await page.route("**/api/projects/*/ai/generate-todos", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: { message: "Controlled rate limit" } }) }));
  await page.getByLabel("Describe the feature").fill("A resilient error test");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Controlled rate limit");
  await page.unroute("**/api/projects/*/ai/generate-todos");
  await page.getByRole("dialog").getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "Plan sprint" }).click();
  await page.route("**/api/projects/*/ai/plan-sprint", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ goal: "Malformed" }) }));
  await page.getByRole("button", { name: "Suggest plan" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("invalid response");
  await page.unroute("**/api/projects/*/ai/plan-sprint");
});

test("browser responsive navigation, dialog focus, and backlog error state", async ({ page }) => {
  await registerAndCreateProject(page, { name: "Access tester", email: "access@example.test", project: "Access Project", key: "ACS" });
  const quick = page.getByLabel("Quick create todo");
  await quick.fill("Focus target");
  await quick.press("Enter");
  await page.setViewportSize({ width: 560, height: 850 });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(page.locator("aside.mobileOpen")).toBeVisible();
  await page.setViewportSize({ width: 768, height: 850 });
  await expect(page.locator("aside")).toHaveCSS("width", "70px");
  await page.setViewportSize({ width: 1024, height: 850 });
  await page.getByRole("button", { name: "Focus target" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Focus target" })).toBeFocused();
  await page.route("**/api/projects/*/todos?sprintId=backlog", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "Controlled backlog failure" } }) }));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Backlog could not be loaded");
});

test("browser maps duplicate registration and login errors and rejects unsafe redirects", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Duplicate Tester");
  await page.getByLabel("Email").fill("duplicate@example.test");
  await page.getByLabel("Password", { exact: true }).fill("browser-password-123");
  await page.getByLabel("Confirm password").fill("browser-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByTitle("Log out").click();
  await page.getByRole("link", { name: "Create one" }).click();
  await page.getByLabel("Name").fill("Duplicate Tester");
  await page.getByLabel("Email").fill("duplicate@example.test");
  await page.getByLabel("Password", { exact: true }).fill("browser-password-123");
  await page.getByLabel("Confirm password").fill("browser-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("An account with this email already exists.")).toBeVisible();
  await page.getByRole("link", { name: "Log in" }).click();
  await page.getByLabel("Email").fill("duplicate@example.test");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await page.goto("/login?redirect=https://untrusted.example");
  await page.getByLabel("Email").fill("duplicate@example.test");
  await page.getByLabel("Password").fill("browser-password-123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/projects$/);
});
