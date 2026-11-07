import { useEffect, useCallback, useRef, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Boxes,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import "./styles.css";
import "./fixes.css";
import { Projects } from "./features/projects.jsx";
import { Backlog } from "./features/backlog.jsx";
import { Board } from "./features/board.jsx";
import { Sprints } from "./features/history.jsx";
import { Assistant } from "./features/assistant.jsx";

import { get, post, setUnauthorized } from "./api/client.js";
import { Field } from "./components/ui.jsx";

import { Auth, Toast, useAuth, useRefresh } from "./hooks/workspace.js";
function Providers() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState(
      () => sessionStorage.getItem("kanbot_auth_notice") || "",
    ),
    [authRedirect, setAuthRedirect] = useState("");
  const authRedirectRef = useRef("");
  const nav = useNavigate();
  const [toasts, setToasts] = useState([]);
  const flash = useCallback((message, type = "ok") => {
    const id = Date.now();
    setToasts((x) => [...x, { id, message, type }]);
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  const logout = useCallback(
    (expired = false) => {
      localStorage.removeItem("kanbot_token");
      setUser(null);
      if (expired) {
        const message = "Your session has expired. Please log in again.";
        sessionStorage.setItem("kanbot_auth_notice", message);
        setNotice(message);
        const target = "/login?redirect=" + encodeURIComponent(location.pathname);
        authRedirectRef.current = target;
        setAuthRedirect(target);
        nav(target);
      } else {
        sessionStorage.removeItem("kanbot_auth_notice");
        setNotice("");
        authRedirectRef.current = "/login";
        setAuthRedirect("/login");
        nav("/login");
      }
    },
    [nav],
  );
  useEffect(() => {
    const unsubscribe = setUnauthorized(() => logout(true));
    if (!localStorage.getItem("kanbot_token")) {
      setReady(true);
      return unsubscribe;
    }
    get("/auth/me")
      .then((x) => setUser(x.user))
      .catch(() => localStorage.removeItem("kanbot_token"))
      .finally(() => setReady(true));
    return unsubscribe;
  }, [logout]);
  const value = {
    user,
    ready,
    notice,
    setNotice,
    authRedirect,
    authRedirectRef,
    login: async (data) => {
      sessionStorage.removeItem("kanbot_auth_notice");
      setNotice("");
      authRedirectRef.current = "";
      setAuthRedirect("");
      localStorage.setItem("kanbot_token", data.token);
      setUser(data.user);
    },
    logout,
  };
  return (
    <Auth.Provider value={value}>
      <Toast.Provider value={flash}>
        <>
          {!ready ? (
            <div className="loadingPage">
              <span className="orb" />
              Loading Kanbot…
            </div>
          ) : (
            <AppRoutes />
          )}
          <div className="toasts" role="status" aria-live="polite">
            {toasts.map((t) => (
              <div className={"toast " + t.type} key={t.id}>
                {t.message}
              </div>
            ))}
          </div>
        </>
      </Toast.Provider>
    </Auth.Provider>
  );
}
function Require() {
  let a = useAuth(),
    l = useLocation();
  return a.user ? (
    <Outlet />
  ) : (
    <Navigate
      to={
        a.authRedirectRef.current ||
        a.authRedirect ||
        "/login?redirect=" + encodeURIComponent(l.pathname + l.search)
      }
      replace
    />
  );
}
function Guest() {
  let a = useAuth();
  return a.user ? <Navigate to="/projects" replace /> : <Outlet />;
}
function AppRoutes() {
  return (
    <Routes>
      <Route element={<Guest />}>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
      </Route>
      <Route element={<Require />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/projects" />} />
          <Route path="/projects" element={<Projects />} />
          <Route
            path="/projects/:projectId"
            element={<Navigate to="backlog" />}
          />
          <Route path="/projects/:projectId/backlog" element={<Backlog />} />
          <Route path="/projects/:projectId/board" element={<Board />} />
          <Route path="/projects/:projectId/sprints" element={<Sprints />} />
          <Route
            path="/projects/:projectId/sprints/:sprintId"
            element={<Sprints />}
          />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
function AuthPage({ mode }) {
  const nav = useNavigate(),
    loc = useLocation(),
    auth = useAuth();
  const [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      confirm: "",
    }),
    [err, setErr] = useState({}),
    [busy, setBusy] = useState(false);
  const register = mode === "register";
  const submit = async (e) => {
    e.preventDefault();
    let errors = {};
    if (register && !form.name.trim()) errors.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      errors.email = "Enter a valid email address";
    if (register && form.password.length < 8)
      errors.password = "Password must be at least 8 characters";
    if (register && form.password !== form.confirm)
      errors.confirm = "Passwords do not match";
    if (Object.keys(errors).length) return setErr(errors);
    setBusy(true);
    setErr({});
    try {
      const data = await post(
        "/auth/" + (register ? "register" : "login"),
        register
          ? { name: form.name, email: form.email, password: form.password }
          : { email: form.email, password: form.password },
      );
      await auth.login(data);
      nav(safeRedirect(new URLSearchParams(loc.search).get("redirect")));
    } catch (e) {
      let fields = Object.fromEntries(
        e.details.map((d) => [d.path, d.message]),
      );
      setErr({ ...fields, form: Object.keys(fields).length ? "" : e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth">
      <form className="authCard" onSubmit={submit}>
        <Brand />
        <p className="eyebrow">YOUR CALM COMMAND CENTER</p>
        <h1>{register ? "Create your workspace" : "Welcome back"}</h1>
        <p className="muted">
          {register
            ? "Build momentum, one sprint at a time."
            : "Pick up exactly where you left off."}
        </p>
        {(err.form || auth.notice) && (
          <div className="alert">{err.form || auth.notice}</div>
        )}
        {register && (
          <Field label="Name" error={err.name}>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
        )}
        <Field label="Email" error={err.email}>
          <input
            type="email"
            autoFocus={!register}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Password" error={err.password}>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {register && (
          <Field label="Confirm password" error={err.confirm}>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </Field>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Log in"}{" "}
          <ChevronRight size={17} />
        </button>
        <p className="center">
          {register ? "Already have an account?" : "New to Kanbot?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Log in" : "Create one"}
          </Link>
        </p>
      </form>
    </main>
  );
}
function safeRedirect(value) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/projects";
}
function Brand() {
  return (
    <div className="brand">
      <img
        className="brand-full"
        src="/kanbot-logo.svg"
        alt="Kanbot"
      />
      <img
        className="brand-icon"
        src="/brand.svg"
        alt="Kanbot"
      />
    </div>
  );
}
function Shell() {
  const { projectId } = useParams(),
    auth = useAuth(),
    nav = useNavigate(),
    [mobile, setMobile] = useState(false),
    [projects, setProjects] = useState([]),
    [ai, setAi] = useState(false),
    [dark, setDark] = useState(localStorage.getItem("kanbot_theme") === "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "";
    localStorage.setItem("kanbot_theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (auth.user)
      get("/projects")
        .then((x) => setProjects(x.projects))
        .catch(() => {});
  }, [auth.user, projectId]);
  useRefresh(
    useCallback(() => {
      get("/projects")
        .then((x) => setProjects(x.projects))
        .catch(() => {});
    }, []),
  );
  let current = projects.find((p) => p.id === projectId);
  return (
    <div className="shell">
      <aside className={mobile ? "mobileOpen" : ""}>
        <Brand />
        <select
          className="projectSelect"
          aria-label="Switch project"
          value={projectId || ""}
          onChange={(e) => {
            setMobile(false);
            nav(
              e.target.value
                ? "/projects/" + e.target.value + "/backlog"
                : "/projects",
            );
          }}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.key} · {p.name}
            </option>
          ))}
        </select>
        {projectId && (
          <nav>
            <small>PROJECT</small>
            <NavLink to={`/projects/${projectId}/backlog`}>
              <ClipboardList />
              Backlog
            </NavLink>
            <NavLink to={`/projects/${projectId}/board`}>
              <LayoutDashboard />
              Active sprint
            </NavLink>
            <NavLink to={`/projects/${projectId}/sprints`}>
              <CalendarDays />
              Sprints
            </NavLink>
          </nav>
        )}
        <nav>
          <NavLink to="/projects">
            <Boxes />
            Projects
          </NavLink>
        </nav>
        <div className="sideFoot">
          <div>
            <b>{auth.user?.name}</b>
            <small>{auth.user?.email}</small>
          </div>
          <button title="Toggle theme" onClick={() => setDark(!dark)}>
            {dark ? <Sun /> : <Moon />}
          </button>
          <button title="Log out" onClick={() => auth.logout()}>
            <LogOut />
          </button>
        </div>
      </aside>
      <section className="page">
        <header>
          <div>
            <p className="eyebrow">PERSONAL AGILE OS</p>
            <h2>{current?.name || "Projects"}</h2>
          </div>
          <div className="topActions">
            <button
              className="iconBtn mobile"
              aria-label="Toggle navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <button className="outline" onClick={() => setDark(!dark)}>
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {projectId && (
              <button className="aiButton" onClick={() => setAi(true)}>
                <Sparkles size={17} />
                Ask AI
              </button>
            )}
          </div>
        </header>
        <Outlet context={{ projects, setProjects, current, setAi }} />
      </section>
      {projectId && (
        <Assistant
          key={projectId}
          open={ai}
          onClose={() => setAi(false)}
          projectId={projectId}
        />
      )}
    </div>
  );
}

function NotFound() {
  return (
    <main className="auth">
      <div className="authCard center">
        <h1>Lost in the backlog?</h1>
        <p>This route does not exist.</p>
        <Link className="primary" to="/projects">
          Go home
        </Link>
      </div>
    </main>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Providers />
    </BrowserRouter>
  );
}
