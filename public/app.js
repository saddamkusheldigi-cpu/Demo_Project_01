const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const emptyState = document.querySelector("#empty-state");
const statusMessage = document.querySelector("#status");

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "Something went wrong.");
  }
  return response.status === 204 ? null : response.json();
}

function renderTasks(tasks) {
  taskList.replaceChildren();
  emptyState.hidden = tasks.length > 0;
  taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

  for (const task of tasks) {
    const item = document.createElement("li");
    item.className = `task-item${task.completed ? " completed" : ""}`;

    const toggle = document.createElement("button");
    toggle.className = "task-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", `${task.completed ? "Mark incomplete" : "Complete"}: ${task.title}`);
    toggle.setAttribute("aria-pressed", String(task.completed));
    toggle.addEventListener("click", () => updateTask(task.id, !task.completed));

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;

    const remove = document.createElement("button");
    remove.className = "delete-task";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove: ${task.title}`);
    remove.addEventListener("click", () => deleteTask(task.id));

    item.append(toggle, title, remove);
    taskList.append(item);
  }
}

async function refreshTasks() {
  try {
    renderTasks(await request("/api/tasks"));
    statusMessage.textContent = "";
  } catch (error) {
    statusMessage.textContent = error.message;
  }
}

async function updateTask(id, completed) {
  statusMessage.textContent = "";
  try {
    await request(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    });
    await refreshTasks();
  } catch (error) {
    statusMessage.textContent = error.message;
  }
}

async function deleteTask(id) {
  statusMessage.textContent = "";
  try {
    await request(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refreshTasks();
  } catch (error) {
    statusMessage.textContent = error.message;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) return;

  statusMessage.textContent = "";
  try {
    await request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    input.value = "";
    input.focus();
    await refreshTasks();
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

refreshTasks();
