const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || "Something went wrong.");
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details || [];
  }
}
let unauthorized = () => {};
export function setUnauthorized(handler) {
  unauthorized = handler;
  return () => {
    unauthorized = () => {};
  };
}
const token = () => localStorage.getItem("kanbot_token");
async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...(opts.headers || {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, {
      error: { message: "Cannot reach the server. Is it running?" },
    });
  }
  if (res.status === 204) return;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new ApiError(res.status, body);
    if (
      res.status === 401 &&
      !path.includes("/auth/login") &&
      !path.includes("/auth/register")
    )
      unauthorized();
    throw e;
  }
  return body;
}
export const get = (p) => api(p),
  post = (p, b) => api(p, { method: "POST", body: b }),
  patch = (p, b) => api(p, { method: "PATCH", body: b }),
  del = (p) => api(p, { method: "DELETE" });
