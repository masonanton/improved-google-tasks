import { getAuthToken, signOut } from "../lib/auth.js";
import { listAllTasks } from "../lib/tasksApi.js";
import { daysUntilDue, severityForTask } from "../lib/severity.js";

const el = {
  signinView: document.getElementById("signin-view"),
  signinBtn: document.getElementById("signin-btn"),
  signoutBtn: document.getElementById("signout-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  status: document.getElementById("status"),
  listsView: document.getElementById("lists-view"),
  listTemplate: document.getElementById("list-template"),
  taskRowTemplate: document.getElementById("task-row-template"),
};

el.signinBtn.addEventListener("click", () => handleSignIn());
el.signoutBtn.addEventListener("click", () => handleSignOut());
el.refreshBtn.addEventListener("click", () => loadTasks());

init();

async function init() {
  try {
    // Silent check: if we already have a cached token, skip the sign-in screen.
    await getAuthToken({ interactive: false });
    showSignedIn();
    await loadTasks();
  } catch {
    showSignedOut();
  }
}

async function handleSignIn() {
  setStatus("Signing in...");
  try {
    await getAuthToken({ interactive: true });
    showSignedIn();
    await loadTasks();
  } catch (err) {
    setStatus(`Sign-in failed: ${err.message}`);
  }
}

async function handleSignOut() {
  await signOut();
  showSignedOut();
  el.listsView.innerHTML = "";
  setStatus("");
}

function showSignedIn() {
  el.signinView.hidden = true;
  el.signoutBtn.hidden = false;
  el.refreshBtn.hidden = false;
  el.listsView.hidden = false;
}

function showSignedOut() {
  el.signinView.hidden = false;
  el.signoutBtn.hidden = true;
  el.refreshBtn.hidden = true;
  el.listsView.hidden = true;
}

function setStatus(text) {
  el.status.textContent = text;
}

async function loadTasks() {
  setStatus("Loading tasks...");
  el.listsView.innerHTML = "";
  try {
    const lists = await listAllTasks({ showCompleted: false });
    renderLists(lists);
    setStatus("");
  } catch (err) {
    setStatus(`Couldn't load tasks: ${err.message}`);
  }
}

function renderLists(lists) {
  const nonEmptyLists = lists.filter(({ tasks }) => tasks.length > 0);

  if (nonEmptyLists.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No open tasks — you're all caught up.";
    el.listsView.appendChild(empty);
    return;
  }

  for (const { list, tasks } of nonEmptyLists) {
    const section = el.listTemplate.content.cloneNode(true);
    section.querySelector(".tasklist-title").textContent = list.title;
    const rowsEl = section.querySelector(".task-rows");

    for (const task of sortByDueDate(tasks)) {
      rowsEl.appendChild(renderTaskRow(task));
    }

    el.listsView.appendChild(section);
  }
}

function sortByDueDate(tasks) {
  return [...tasks].sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return new Date(a.due) - new Date(b.due);
  });
}

function renderTaskRow(task) {
  const row = el.taskRowTemplate.content.cloneNode(true);
  const li = row.querySelector(".task-row");
  const severity = severityForTask(task);

  li.classList.add(severity);
  row.querySelector(".task-title").textContent = task.title || "(untitled)";
  row.querySelector(".task-due").textContent = formatDue(task.due);

  return row;
}

function formatDue(dueIso) {
  if (!dueIso) return "";
  const days = daysUntilDue(dueIso);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "Overdue by 1 day";
  return `Overdue by ${Math.abs(days)} days`;
}
