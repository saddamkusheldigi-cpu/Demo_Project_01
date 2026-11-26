const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { after, before, test } = require("node:test");

let serverProcess;
let baseUrl;
let serverOutput = "";

async function getAvailablePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => {
    listener.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

before(async () => {
  const port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });

  let connectionError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Server exited before becoming ready.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/tasks`);
      if (response.ok) return;
    } catch (error) {
      connectionError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Server did not become ready in time: ${connectionError?.message || "unexpected response"}\n${serverOutput}`,
  );
});

after(() => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
  }
});

test("task API validates, creates, lists, updates, and deletes tasks", async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: " " }),
  });
  assert.equal(invalidResponse.status, 400);

  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Automated API test" }),
  });
  assert.equal(createResponse.status, 201);
  const task = await createResponse.json();
  assert.equal(task.title, "Automated API test");
  assert.equal(task.completed, false);

  try {
    const listResponse = await fetch(`${baseUrl}/api/tasks`);
    const tasks = await listResponse.json();
    assert.ok(tasks.some((item) => item.id === task.id));

    const updateResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).completed, true);
  } finally {
    const deleteResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
      method: "DELETE",
    });
    assert.equal(deleteResponse.status, 204);
  }
});
