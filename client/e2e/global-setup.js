import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const client = fileURLToPath(new URL("..", import.meta.url));

async function waitFor(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The child process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup() {
  const dataFile = join(tmpdir(), "kanbot-playwright-db.json");
  await rm(dataFile, { force: true });
  const backend = spawn(process.execPath, [join(root, "server", "dist", "index.js")], {
    cwd: root,
    env: {
      ...process.env,
      PORT: "50021",
      NODE_ENV: "test",
      DATA_FILE: dataFile,
      AI_API_KEY: "",
      CLIENT_ORIGIN: "http://127.0.0.1:49187",
    },
    stdio: "pipe",
  });
  backend.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitFor("http://127.0.0.1:50021/api/health");

  process.env.VITE_API_URL = "http://127.0.0.1:50021/api";
  const frontend = await createServer({
    root: client,
    server: { host: "127.0.0.1", port: 49187, strictPort: true },
  });
  await frontend.listen();

  return async () => {
    await frontend.close();
    backend.kill();
  };
}
