import { getAuthToken, signOut } from "../lib/auth.js";
import { listAllTasks, patchTask } from "../lib/tasksApi.js";
import { daysUntilDue, severityForTask } from "../lib/severity.js";
import { parseNotes, serializeNotes } from "../lib/notesEncoding.js";

const el = {
  signinView: document.getElementById("signin-view"),
  signinBtn: document.getElementById("signin-btn"),
  signoutBtn: document.getElementById("signout-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  status: document.getElementById("status"),
  listsView: document.getElementById("lists-view"),
  perListSections: document.getElementById("per-list-sections"),
  inProgressSection: document.getElementById("in-progress-section"),
  inProgressRows: document.getElementById("in-progress-rows"),
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
  el.perListSections.innerHTML = "";
  el.inProgressRows.innerHTML = "";
  el.inProgressSection.hidden = true;
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
  el.perListSections.innerHTML = "";
  el.inProgressRows.innerHTML = "";
  el.inProgressSection.hidden = true;
  try {
    const lists = await listAllTasks({ showCompleted: false });
    renderInProgress(lists);
    renderLists(lists);
    setStatus("");
  } catch (err) {
    setStatus(`Couldn't load tasks: ${err.message}`);
  }
}

// Any task with a progress value between 1-99% is "in progress" — this
// aggregates them across every list into one pinned view at the top,
// regardless of which list they actually live in.
function renderInProgress(lists) {
  const inProgress = lists.flatMap(({ list, tasks }) =>
    tasks
      .filter((task) => {
        const { progress } = parseNotes(task.notes);
        return progress !== null && progress > 0 && progress < 100;
      })
      .map((task) => ({ task, tasklistId: list.id, listTitle: list.title }))
  );

  if (inProgress.length === 0) return;

  inProgress.sort((a, b) => compareDue(a.task.due, b.task.due));

  el.inProgressSection.hidden = false;
  for (const { task, tasklistId, listTitle } of inProgress) {
    el.inProgressRows.appendChild(renderTaskRow(task, tasklistId, { listTitle }));
  }
}

function renderLists(lists) {
  const nonEmptyLists = lists.filter(({ tasks }) => tasks.length > 0);

  if (nonEmptyLists.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No open tasks — you're all caught up.";
    el.perListSections.appendChild(empty);
    return;
  }

  for (const { list, tasks } of nonEmptyLists) {
    const section = el.listTemplate.content.cloneNode(true);
    section.querySelector(".tasklist-title").textContent = list.title;
    const rowsEl = section.querySelector(".task-rows");

    for (const task of sortByDueDate(tasks)) {
      rowsEl.appendChild(renderTaskRow(task, list.id));
    }

    el.perListSections.appendChild(section);
  }
}

function sortByDueDate(tasks) {
  return [...tasks].sort((a, b) => compareDue(a.due, b.due));
}

function compareDue(dueA, dueB) {
  if (!dueA && !dueB) return 0;
  if (!dueA) return 1;
  if (!dueB) return -1;
  return new Date(dueA) - new Date(dueB);
}

function renderTaskRow(task, tasklistId, { listTitle } = {}) {
  const row = el.taskRowTemplate.content.cloneNode(true);
  const li = row.querySelector(".task-row");
  const mainBtn = row.querySelector(".task-main");
  const detail = row.querySelector(".task-detail");
  const fill = row.querySelector(".progress-fill");
  const track = row.querySelector(".progress-track");
  const valueEl = row.querySelector(".progress-value");
  const input = row.querySelector(".progress-input");
  const notesTextEl = row.querySelector(".task-notes-text");

  li.classList.add(severityForTask(task));
  row.querySelector(".task-title").textContent = task.title || "(untitled)";
  row.querySelector(".task-due").textContent = formatDue(task.due);
  if (listTitle) {
    row.querySelector(".task-list-badge").textContent = listTitle;
  }

  const parsed = parseNotes(task.notes);
  let currentProgress = parsed.progress ?? 0;
  const currentStatus = parsed.status; // unused for now, preserved so we never clobber it
  notesTextEl.textContent = parsed.text.trim();

  const progressEls = { li, fill, track, valueEl, input };
  setProgressUI(progressEls, currentProgress);

  mainBtn.addEventListener("click", () => {
    detail.hidden = !detail.hidden;
  });

  input.addEventListener("change", async () => {
    const newProgress = Number(input.value);
    const previousProgress = currentProgress;
    setProgressUI(progressEls, newProgress); // optimistic update

    try {
      const newNotes = serializeNotes({
        text: parsed.text,
        progress: newProgress,
        status: currentStatus,
      });
      await patchTask(tasklistId, task.id, { notes: newNotes });
      task.notes = newNotes;
      currentProgress = newProgress;
    } catch (err) {
      setProgressUI(progressEls, previousProgress); // revert on failure
      setStatus(`Couldn't update progress: ${err.message}`);
    }
  });

  return row;
}

function setProgressUI({ li, fill, track, valueEl, input }, progress) {
  fill.style.width = `${progress}%`;
  valueEl.textContent = progress;
  input.value = progress;
  track.title = `${progress}% complete`;
  li.classList.toggle("progress-complete", progress >= 100);
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
