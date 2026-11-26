const http = require("node:http");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, "data", "tasks.json");
const pool = new Pool({
  host: process.env.DATABASE_HOST || "localhost",
  port: Number(process.env.DATABASE_PORT) || 5432,
  database: process.env.DATABASE_NAME || "little_list",
  user: process.env.DATABASE_USER || "little_list",
  password: process.env.DATABASE_PASSWORD || "little_list",
});
const PUBLIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  try {
    const existing = await pool.query("SELECT COUNT(*)::int AS count FROM tasks");
    if (existing.rows[0].count > 0) return;

    const data = await fs.readFile(DATA_FILE, "utf8");
    const tasks = JSON.parse(data);
    for (const task of tasks) {
      await pool.query(
        "INSERT INTO tasks (id, title, completed) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
        [task.id, task.title, Boolean(task.completed)],
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 10_000) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    throw error;
  }
}

async function handleApi(request, response, url) {
  const taskRoute = url.pathname.match(/^\/api\/tasks(?:\/([^/]+))?$/);
  if (!taskRoute) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  const taskId = taskRoute[1];

  if (request.method === "GET" && !taskId) {
    const result = await pool.query(
      "SELECT id, title, completed FROM tasks ORDER BY created_at DESC",
    );
    sendJson(response, 200, result.rows);
    return;
  }

  if (request.method === "POST" && !taskId) {
    const body = await readJsonBody(request);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120) {
      sendJson(response, 400, { error: "Task title must be between 1 and 120 characters." });
      return;
    }

    const task = { id: randomUUID(), title, completed: false };
    await pool.query(
      "INSERT INTO tasks (id, title, completed) VALUES ($1, $2, $3)",
      [task.id, task.title, task.completed],
    );
    sendJson(response, 201, task);
    return;
  }

  if (request.method === "PATCH") {
    const body = await readJsonBody(request);
    if (typeof body.completed !== "boolean") {
      sendJson(response, 400, { error: "Completed must be true or false." });
      return;
    }
    const result = await pool.query(
      "UPDATE tasks SET completed = $1 WHERE id = $2 RETURNING id, title, completed",
      [body.completed, taskId],
    );
    if (result.rowCount === 0) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }
    sendJson(response, 200, result.rows[0]);
    return;
  }

  if (request.method === "DELETE") {
    const result = await pool.query("DELETE FROM tasks WHERE id = $1", [taskId]);
    if (result.rowCount === 0) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

const server = http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");

  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const file = PUBLIC_FILES.get(url.pathname);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found.");
      return;
    }

    const content = await fs.readFile(path.join(__dirname, "public", file[0]));
    response.writeHead(200, {
      "Content-Type": file[1],
      "Content-Length": content.length,
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    sendJson(response, error.status || 500, {
      error: error.status ? error.message : "An unexpected server error occurred.",
    });
    if (!error.status) console.error(error);
  }
});

async function start() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await initializeDatabase();
      server.listen(PORT, () => {
        console.log(`Task list is running at http://localhost:${PORT}`);
      });
      return;
    } catch (error) {
      if (attempt === 30) {
        console.error("Unable to connect to PostgreSQL.");
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
