(function () {
  "use strict";

  const invoke =
    (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) ||
    (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) ||
    null;
  const BRIDGE = typeof invoke === "function";
  const STORAGE_KEY = "e2e-runner:tasks:v1";
  const SEED = [
    { id: 1, title: "Préparer la livraison", done: 0 },
    { id: 2, title: "Relancer le client", done: 0 },
    { id: 3, title: "Archiver le dossier", done: 1 },
  ];

  const menuToggle = document.getElementById("menu-toggle");
  const menuClose = document.getElementById("menu-close");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const sidebar = document.getElementById("sidebar");
  const notificationsToggle = document.getElementById("notifications-toggle");
  const notificationBadge = document.getElementById("notification-badge");
  const notificationsPanel = document.getElementById("notifications-panel");
  const markRead = document.getElementById("mark-read");
  const notificationList = document.getElementById("notification-list");
  const form = document.getElementById("task-form");
  const input = document.getElementById("task-title");
  const formError = document.getElementById("form-error");
  const submitButton = form.querySelector('button[type="submit"]');
  const taskList = document.getElementById("task-list");
  const emptyState = document.getElementById("empty-state");
  const taskCount = document.getElementById("task-count");
  const doneCount = document.getElementById("done-count");
  const toastRegion = document.getElementById("toast-region");

  let tasks = [];

  function localRows() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
    } catch {
      // Memory fallback when storage is unavailable.
    }
    return SEED.map((row) => ({ ...row }));
  }

  function saveLocal(rows) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // Ignore storage errors in the preview fallback.
    }
  }

  async function listTasks() {
    if (BRIDGE) {
      return invoke("db_select", {
        query: "SELECT id, title, done FROM tasks ORDER BY id ASC",
        params: [],
      });
    }
    return localRows();
  }

  async function addTask(title) {
    if (BRIDGE) {
      return invoke("db_execute", {
        query:
          "INSERT INTO tasks (title, done, updated_at) VALUES (?1, 0, datetime('now'))",
        params: [title],
      });
    }
    const rows = localRows();
    rows.push({ id: Date.now(), title, done: 0 });
    saveLocal(rows);
    return 1;
  }

  async function toggleTask(id) {
    if (BRIDGE) {
      return invoke("db_execute", {
        query:
          "UPDATE tasks SET done = CASE done WHEN 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?1",
        params: [id],
      });
    }
    const rows = localRows().map((row) =>
      Number(row.id) === Number(id) ? { ...row, done: row.done ? 0 : 1 } : row,
    );
    saveLocal(rows);
    return 1;
  }

  async function deleteTask(id) {
    if (BRIDGE) {
      return invoke("db_execute", {
        query: "DELETE FROM tasks WHERE id = ?1",
        params: [id],
      });
    }
    saveLocal(localRows().filter((row) => Number(row.id) !== Number(id)));
    return 1;
  }

  function toast(message) {
    const element = document.createElement("div");
    element.className = "toast";
    element.textContent = message;
    toastRegion.appendChild(element);
    window.setTimeout(() => element.remove(), 2500);
  }

  function render() {
    taskList.innerHTML = "";

    for (const task of tasks) {
      const item = document.createElement("li");
      item.className = task.done ? "task-item is-done" : "task-item";

      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = task.title;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.setAttribute("aria-label", `Basculer ${task.title}`);
      toggle.textContent = task.done ? "Rouvrir" : "Terminer";
      toggle.addEventListener("click", async () => {
        await toggleTask(task.id);
        await refresh();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete";
      remove.setAttribute("aria-label", `Supprimer ${task.title}`);
      remove.textContent = "Supprimer";
      remove.addEventListener("click", async () => {
        await deleteTask(task.id);
        await refresh();
        toast(`« ${task.title} » supprimée.`);
      });

      item.append(title, toggle, remove);
      taskList.appendChild(item);
    }

    const done = tasks.filter((task) => Number(task.done) === 1).length;
    taskCount.textContent = String(tasks.length);
    doneCount.textContent = String(done);
    emptyState.hidden = tasks.length > 0;
  }

  async function refresh() {
    try {
      tasks = await listTasks();
      render();
    } catch (error) {
      formError.textContent = error instanceof Error ? error.message : String(error);
      formError.hidden = false;
    }
  }

  function setPanel(open) {
    notificationsPanel.hidden = !open;
    notificationsToggle.setAttribute("aria-expanded", String(open));

    if (open) {
      markAllRead();
    }
  }

  function markAllRead() {
    for (const item of notificationList.querySelectorAll("li")) {
      item.dataset.unread = "false";
    }

    notificationBadge.hidden = true;
    notificationBadge.textContent = "0";
  }

  function setDrawer(open) {
    sidebar.hidden = !open;
    drawerOverlay.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  }

  menuToggle.addEventListener("click", () => {
    setDrawer(sidebar.hidden);
  });

  menuClose.addEventListener("click", () => setDrawer(false));
  drawerOverlay.addEventListener("click", () => setDrawer(false));

  notificationsToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setPanel(notificationsPanel.hidden);
  });

  markRead.addEventListener("click", markAllRead);

  document.addEventListener("click", (event) => {
    if (
      !notificationsPanel.hidden &&
      !notificationsPanel.contains(event.target) &&
      !notificationsToggle.contains(event.target)
    ) {
      setPanel(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    setPanel(false);
    setDrawer(false);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.hidden = true;

    const title = input.value.trim();

    if (!title) {
      formError.textContent = "Le titre de la tâche est obligatoire.";
      formError.hidden = false;
      input.focus();
      return;
    }

    submitButton.disabled = true;

    try {
      // Small delay to exercise the busy state.
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      await addTask(title);
      input.value = "";
      await refresh();
      toast("Tâche ajoutée.");
      input.focus();
    } catch (error) {
      formError.textContent =
        error instanceof Error ? error.message : String(error);
      formError.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });

  refresh();
})();
