/* Configure this after deploying Code.gs as a Google Apps Script Web App. */
const API_URL = "https://script.google.com/macros/s/AKfycbx-pZYyMUFtv4qdt1wMWb9Ae-lOFang8uzrWcaSaGVYxx8muzWZyjUdsVkGcSC1LuMX/exec";

const state = { tasks: [], filter: "all", priority: "all", search: "", busy: false };
const $ = (id) => document.getElementById(id);
const toast = window.bootstrap ? new bootstrap.Toast($("appToast"), { delay: 3000 }) : null;

document.addEventListener("DOMContentLoaded", () => {
  updateClock();
  setInterval(updateClock, 1000);
  bindEvents();
  loadTasks();
  checkReminders();
  setInterval(checkReminders, 30000);
});

function updateClock() {
  const now = new Date();
  $("currentDate").textContent = now.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
  $("currentTime").textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}
function bindEvents() {
  $("taskForm").addEventListener("submit", saveTask);
  $("addTaskBtn").addEventListener("click", () => { resetForm(); $("taskTitle").focus(); $("createPanel").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("cancelEditBtn").addEventListener("click", resetForm);
  $("refreshBtn").addEventListener("click", loadTasks);
  $("notificationBtn").addEventListener("click", enableNotifications);
  $("searchInput").addEventListener("input", e => { state.search = e.target.value.trim().toLowerCase(); renderTasks(); });
  $("priorityFilter").addEventListener("change", e => { state.priority = e.target.value; renderTasks(); });
  document.querySelectorAll("[data-filter]").forEach(btn => btn.addEventListener("click", () => setFilter(btn.dataset.filter)));
  document.querySelectorAll("[data-filter-link]").forEach(link => link.addEventListener("click", () => setFilter(link.dataset.filterLink)));
  $("taskList").addEventListener("click", handleTaskAction);
  $("taskList").addEventListener("change", e => { if (e.target.matches(".task-check")) toggleTask(e.target.dataset.id, e.target.checked); });
}
function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b.dataset.filter === filter));
  renderTasks();
}
function apiConfigured() { return API_URL && !API_URL.includes("PASTE_YOUR"); }
async function apiRequest(payload = null) {
  if (!apiConfigured()) throw new Error("Add your Apps Script Web App URL in js/app.js first.");
  const url = API_URL;
  const options = payload ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) } : { method: "GET", cache: "no-store" };
  const response = await fetch(url, options);
  if (!response.ok) throw new Error("Request failed (" + response.status + "). Check your Apps Script deployment.");
  const data = await response.json();
  if (!data.success) throw new Error(data.message || "The server could not complete the request.");
  return data;
}
async function loadTasks() {
  setBusy(true);
  $("taskList").innerHTML = '<div class="empty-state"><span class="loader-ring"></span><p>Syncing with Google Sheets...</p></div>';
  try {
    const data = await apiRequest();
    state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    $("dbStatus").textContent = "CONNECTED";
    $("dbStatus").style.color = "var(--green)";
    $("syncStatus").textContent = "SYNCED";
    renderTasks();
  } catch (err) {
    $("dbStatus").textContent = "OFFLINE";
    $("dbStatus").style.color = "var(--red)";
    $("syncStatus").textContent = "CHECK SETUP";
    $("taskList").innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><strong>Unable to connect</strong><p>${escapeHtml(err.message)}</p><small>Configure the Apps Script URL, deploy it for access, then refresh.</small></div>`;
    updateStats();
    showToast(err.message);
  } finally { setBusy(false); }
}
async function saveTask(event) {
  event.preventDefault();
  const id = $("taskId").value;
  const title = $("taskTitle").value.trim();
  if (!title) return showToast("Please enter a task title.");
  const task = {
    id: id || undefined, title, description: $("taskDescription").value.trim(),
    priority: $("taskPriority").value, dueDate: $("taskDueDate").value, dueTime: $("taskDueTime").value,
    category: $("taskCategory").value, completed: id ? !!findTask(id)?.completed : false
  };
  const btn = $("saveTaskBtn");
  btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Syncing...';
  try {
    const result = await apiRequest({ action: id ? "update" : "create", task });
    if (result.task) {
      const idx = state.tasks.findIndex(t => String(t.id) === String(result.task.id));
      if (idx >= 0) state.tasks[idx] = result.task; else state.tasks.unshift(result.task);
    } else await loadTasks();
    renderTasks(); resetForm(); showToast(id ? "Task updated successfully." : "Task added successfully.");
  } catch (err) { showToast(err.message); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Save Task'; }
}
async function toggleTask(id, completed) {
  const task = findTask(id); if (!task) return;
  const previous = task.completed; task.completed = completed; renderTasks();
  try {
    const result = await apiRequest({ action: "toggle", id, completed });
    if (result.task) Object.assign(task, result.task);
    renderTasks(); showToast(completed ? "Task marked completed." : "Task moved to pending.");
  } catch (err) { task.completed = previous; renderTasks(); showToast(err.message); }
}
async function deleteTask(id) {
  const task = findTask(id);
  if (!task || !confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
  try {
    await apiRequest({ action: "delete", id });
    state.tasks = state.tasks.filter(t => String(t.id) !== String(id));
    renderTasks(); showToast("Task deleted.");
  } catch (err) { showToast(err.message); }
}
function handleTaskAction(e) {
  const button = e.target.closest("[data-action]"); if (!button) return;
  const id = button.dataset.id, action = button.dataset.action;
  if (action === "edit") editTask(id);
  if (action === "delete") deleteTask(id);
}
function editTask(id) {
  const t = findTask(id); if (!t) return;
  $("taskId").value = t.id; $("taskTitle").value = t.title || ""; $("taskDescription").value = t.description || "";
  $("taskPriority").value = t.priority || "Medium"; $("taskDueDate").value = t.dueDate || ""; $("taskDueTime").value = t.dueTime || ""; $("taskCategory").value = t.category || "Personal";
  $("formTitle").textContent = "Edit Task"; $("saveTaskBtn").innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Update Task'; $("cancelEditBtn").hidden = false;
  $("createPanel").scrollIntoView({ behavior: "smooth", block: "start" }); $("taskTitle").focus();
}
function resetForm() {
  $("taskForm").reset(); $("taskId").value = ""; $("formTitle").textContent = "Create Task";
  $("saveTaskBtn").innerHTML = '<i class="fa-solid fa-plus me-2"></i>Save Task'; $("cancelEditBtn").hidden = true;
  $("taskPriority").value = "Medium"; $("taskDueTime").value = ""; $("taskCategory").value = "Personal";
}
function findTask(id) { return state.tasks.find(t => String(t.id) === String(id)); }
function renderTasks() {
  updateStats();
  const today = localDateString(new Date());
  let tasks = [...state.tasks];
  if (state.filter === "today") tasks = tasks.filter(t => t.dueDate === today);
  if (state.filter === "pending") tasks = tasks.filter(t => !t.completed);
  if (state.filter === "completed") tasks = tasks.filter(t => t.completed);
  if (state.priority !== "all") tasks = tasks.filter(t => (t.priority || "Medium") === state.priority);
  if (state.search) tasks = tasks.filter(t => [t.title,t.description,t.category,t.priority].some(v => String(v || "").toLowerCase().includes(state.search)));
  tasks.sort((a,b) => Number(!!a.completed)-Number(!!b.completed) || dueSort(a.dueDate)-dueSort(b.dueDate));
  $("visibleCount").textContent = tasks.length;
  $("navAll").textContent = state.tasks.length;
  $("listFooterText").textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"} displayed`;
  if (!tasks.length) {
    $("taskList").innerHTML = `<div class="empty-state"><i class="fa-solid fa-clipboard-check"></i><strong>No tasks found</strong><p>Add a task or change your filters.</p></div>`;
    return;
  }
  $("taskList").innerHTML = tasks.map(t => {
    const overdue = isOverdue(t);
    const due = t.dueDate ? `<span class="meta-chip ${overdue ? "due-overdue" : ""}"><i class="fa-regular fa-calendar"></i>${escapeHtml(formatDate(t.dueDate))}${t.dueTime ? " · " + escapeHtml(formatTime(t.dueTime)) : ""}${overdue ? " · OVERDUE" : ""}</span>` : "";
    return `<article class="task-item ${t.completed ? "is-completed" : ""}">
      <input class="task-check" type="checkbox" aria-label="Mark ${escapeHtml(t.title)} complete" data-id="${escapeHtml(t.id)}" ${t.completed ? "checked" : ""}>
      <div class="task-body"><div class="task-title">${escapeHtml(t.title)}</div>${t.description ? `<div class="task-description">${escapeHtml(t.description)}</div>` : ""}
      <div class="task-meta"><span class="priority-badge priority-${safePriority(t.priority)}">${escapeHtml((t.priority || "Medium").toUpperCase())}</span><span class="meta-chip"><i class="fa-solid fa-folder"></i>${escapeHtml(t.category || "Personal")}</span>${due}<span class="meta-chip">${t.completed ? '<i class="fa-solid fa-check"></i> Done' : '<i class="fa-regular fa-clock"></i> Pending'}</span></div></div>
      <div class="task-actions"><button class="task-action" data-action="edit" data-id="${escapeHtml(t.id)}" title="Edit task" aria-label="Edit task"><i class="fa-solid fa-pen"></i></button><button class="task-action delete" data-action="delete" data-id="${escapeHtml(t.id)}" title="Delete task" aria-label="Delete task"><i class="fa-solid fa-trash"></i></button></div>
    </article>`;
  }).join("");
}
function updateStats() {
  const total = state.tasks.length, completed = state.tasks.filter(t => t.completed).length, pending = total-completed, today = localDateString(new Date());
  const dueToday = state.tasks.filter(t => t.dueDate === today && !t.completed).length, pct = total ? Math.round(completed/total*100) : 0;
  $("totalCount").textContent = total; $("completedCount").textContent = completed; $("pendingCount").textContent = pending; $("todayCount").textContent = dueToday;
  $("completedFoot").textContent = `${pct}% completion rate`; $("progressPercent").textContent = `${pct}%`;
  $("legendDone").textContent = completed; $("legendPending").textContent = pending; $("progressCaption").textContent = `${completed} / ${total} tasks`;
  $("progressBar").style.width = `${pct}%`; $("progressRing").style.background = `conic-gradient(var(--cyan) ${pct*3.6}deg, #0d2d40 0deg)`;
}
function dueSort(value) { return value ? new Date(value+"T00:00:00").getTime() : Number.MAX_SAFE_INTEGER; }
function localDateString(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function formatDate(value) { const d = new Date(value+"T00:00:00"); return d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}); }
function safePriority(value) { return ["High","Medium","Low"].includes(value) ? value : "Medium"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function setBusy(value) { state.busy = value; $("refreshBtn").disabled = value; $("refreshBtn").innerHTML = value ? '<i class="fa-solid fa-rotate fa-spin"></i>' : '<i class="fa-solid fa-rotate"></i>'; }
function showToast(message) { $("toastMessage").textContent = message; if (toast) toast.show(); else alert(message); }


// Reminders run while this dashboard is open. Browser notifications require permission.
async function enableNotifications() {
  if (!("Notification" in window)) { showToast("This browser does not support desktop notifications."); return; }
  try {
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      $("notificationBtn").classList.add("notifications-enabled");
      showToast("Desktop reminders enabled.");
      sendReminder("JARVIS reminders enabled", "Upcoming and overdue tasks will alert you while this dashboard is open.", "permission-confirmed");
    } else showToast("Desktop notifications are blocked. Allow them in your browser site settings.");
  } catch (_) { showToast("Could not enable desktop notifications in this browser."); }
}
function reminderKey(key) { try { return localStorage.getItem("jarvis-reminder:" + key); } catch (_) { return null; } }
function markReminder(key) { try { localStorage.setItem("jarvis-reminder:" + key, "1"); } catch (_) {} }
function dueDateTime(task) {
  if (!task.dueDate) return null;
  const time = task.dueTime || "23:59";
  const d = new Date(task.dueDate + "T" + time + ":00");
  return Number.isNaN(d.getTime()) ? null : d;
}
function isOverdue(task) { const due = dueDateTime(task); return !!(due && !task.completed && due.getTime() < Date.now()); }
function formatTime(value) { const parts = String(value || "").split(":"); if (parts.length < 2) return value; const d = new Date(); d.setHours(Number(parts[0]), Number(parts[1]), 0, 0); return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}); }
function checkReminders() {
  if (!Array.isArray(state.tasks) || !state.tasks.length) return;
  const now = Date.now();
  state.tasks.forEach(task => {
    if (task.completed) return;
    const due = dueDateTime(task); if (!due) return;
    const dueMs = due.getTime();
    const stamp = task.dueDate + "-" + (task.dueTime || "23:59");
    const upcomingKey = "upcoming-" + task.id + "-" + stamp;
    if (dueMs >= now && dueMs - now <= 15 * 60 * 1000 && !reminderKey(upcomingKey)) {
      markReminder(upcomingKey);
      sendReminder("Task due in 15 minutes", task.title + " is due at " + formatTime(task.dueTime || "23:59") + ".", upcomingKey);
    }
    if (dueMs < now) {
      const day = localDateString(new Date());
      const overdueKey = "overdue-" + task.id + "-" + stamp + "-" + day;
      if (!reminderKey(overdueKey)) {
        markReminder(overdueKey);
        sendReminder("Overdue task", task.title + " is past its deadline and still incomplete.", overdueKey);
      }
    }
  });
}
function sendReminder(title, body, key) {
  showToast(title + ": " + body);
  if ("Notification" in window && Notification.permission === "granted") {
    try { const n = new Notification(title, { body, tag: key, icon: "" }); n.onclick = () => { window.focus(); document.getElementById("tasks").scrollIntoView({behavior:"smooth"}); n.close(); }; } catch (_) {}
  }
}
