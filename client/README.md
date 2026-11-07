# Kanbot client

React + Vite frontend for Kanbot's existing Express API. The client intentionally uses JavaScript and JSX (rather than the documentation's TypeScript-strict recommendation) for this training assignment.

## Stack

React, React Router, native accessible HTML drag-and-drop with menu/status alternatives, React Markdown, Lucide icons, and a custom responsive CSS design system. All data operations use the real backend API configured by `VITE_API_URL`.

## Run locally

Copy `.env.example` to `.env`, set `VITE_API_URL=http://localhost:4000/api`, then run `npm.cmd install` and `npm.cmd run dev`. Do not put any AI key in this client.

Gemini is configured only in `server/.env` with `AI_API_KEY`, `AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, and `AI_MODEL` set to the model available to your account. Preserve your working model setting (the local troubleshooting session used `gemini-3.5-flash-lite` after the earlier model returned 404). Model availability and quotas can change. Restart the backend after changing its environment. Never put the key in `VITE_` variables or commit `.env`.

From the repository root in Windows PowerShell:

```powershell
cd server
npm.cmd install
# Only create .env if it does not already exist:
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
# Paste your key into AI_API_KEY in that local file, not into a terminal command.
# Set AI_BASE_URL and AI_MODEL as described above; keep other server settings.
npm.cmd run dev
```

In a separate terminal, from the repository root:

```powershell
cd client
npm.cmd install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

Open the localhost URL printed by Vite. The backend must also stay running. A health response proves the server is reachable, not that Gemini works. Sign in, open a project, use Ask AI and send a question to verify a real provider response. A Mock AI badge means real AI is not configured. Provider 404 errors require checking the base URL and model; quota, key and timeout errors are surfaced by the backend. Do not change providers to hide a failure.

## Structure and design

- `src/App.jsx`: routing, authentication, layout and theme.
- `src/api/client.js`: centralized API transport and session-expiry handling.
- `src/hooks/workspace.js`: shared contexts and refresh notifications after mutations.
- `src/features/`: project, backlog, todo, board, sprint, history and AI interfaces.
- `src/components/`: reusable fields, native modal dialogs, states and sprint actions.
- `src/lib/board.js`: immutable optimistic board updates.
- `src/test/`: component regressions and an isolated real-backend workflow test.

Native modal dialogs support Escape, focus restoration and unsaved-change checks. Dragging has keyboard-operable move controls; failed optimistic moves restore the prior state. AI drafts and plans require explicit confirmation. Refresh notifications update the workspace after AI actions. Themes persist locally and reduced-motion preferences are respected.

## Verification and limitations

Install dependencies in both `server/` and `client/`, then run from `client/`:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
# After `cd ../server; npm.cmd run build`:
npm.cmd run test:e2e
```

The test suite covers chat history, summary retries, selected/edited AI drafts, planning confirmation, sprint start dates, completion after a summary failure, blank sprint names, optimistic rollback, duplicate drop prevention and unsaved changes. Its full workflow registers a user, creates a project, generates and saves reviewed tasks, plans/starts a sprint, moves a task, completes the sprint with carryover and inspects its summary/history against the supplied Express API.

The latest audit also added the board's days-remaining indicator, persistent inline retry states for failed AI generation and planning, and explicit mutation feedback for project, todo, and sprint saves. See [`../QA_AUDIT.md`](../QA_AUDIT.md) for executed evidence and the remaining verification limits.

That workflow deliberately uses the backend's mock AI with a temporary database, without loading or modifying `server/.env`. It does **not** prove live Gemini availability. No production UI action is replaced with test data. Tests run in jsdom; real-browser visual, touch, focus-trapping and responsive verification remain manual. Check light/dark modes and mobile navigation in your browser, and repeat the workflow with your configured Gemini key before submission. No backend business logic or database schema is modified.

## Functionality

Authentication persistence and expiry handling; project CRUD and switching; backlog search/filter/quick-add/edit/delete/reorder and sprint movement; planned/active/completed sprint lifecycle, board and history; AI chat, draft task generation, sprint planning and summaries. AI output is Markdown-rendered, status-aware, error-safe, and never saved without confirmation.

## Deployment

For Netlify or Vercel use root `client`, build command `npm run build`, output `dist`, and set `VITE_API_URL` to a publicly reachable HTTPS backend API. Configure SPA fallback to `index.html` (Vercel handles it with a rewrite; Netlify use `/* /index.html 200`). A public frontend cannot use a visitor's localhost backend. Set the production server's `CLIENT_ORIGIN` to the frontend URL and keep the Gemini key only in the server environment.
