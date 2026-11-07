import { Plus } from "lucide-react";
export function Metric({ label, value }) {
  return (
    <div className="metric">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}
export function Status({ s }) {
  return <span className={"status " + s}>{s}</span>;
}
export function Loading() {
  return (
    <div className="loading">
      <span className="orb" />
      Loading your workspace…
    </div>
  );
}
export function Empty({ icon, title, body, action, label }) {
  return (
    <section className="empty">
      <div>{icon}</div>
      <h2>{title}</h2>
      <p>{body}</p>
      {action && (
        <button className="primary" onClick={action}>
          <Plus />
          {label}
        </button>
      )}
    </section>
  );
}
