import { listAllTasks } from "./lib/tasksApi.js";
import { severityForTask, SEVERITY } from "./lib/severity.js";

const ALARM_NAME = "due-date-check";
const CHECK_INTERVAL_MINUTES = 15;
const NOTIFIED_SEVERITY_KEY = "notifiedSeverityByTaskId";

const NOTIFICATION_COPY = {
  [SEVERITY.SOON]: (title) => ({
    title: "Task due soon",
    message: `"${title}" is due within 3 days.`,
    priority: 0,
  }),
  [SEVERITY.URGENT]: (title) => ({
    title: "Task due today",
    message: `"${title}" is due today!`,
    priority: 1,
  }),
  [SEVERITY.OVERDUE]: (title) => ({
    title: "Task overdue",
    message: `"${title}" is overdue.`,
    priority: 2,
  }),
};

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// No toolbar badge is used — clear any left over from a previous version.
chrome.action.setBadgeText({ text: "" }).catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES, delayInMinutes: 0 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES, delayInMinutes: 0 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) checkDueDates();
});

async function checkDueDates() {
  let lists;
  try {
    // Non-interactive: this runs unattended, so never pop an OAuth window.
    // If the user hasn't signed in yet from the side panel, this just no-ops
    // until they do.
    lists = await listAllTasks({ showCompleted: false, interactive: false });
  } catch (err) {
    console.warn("[improved-google-tasks] skipping due-date check:", err.message);
    return;
  }

  const allTasks = lists.flatMap(({ tasks }) => tasks);
  const now = new Date();
  const severityByTaskId = new Map();
  for (const task of allTasks) {
    severityByTaskId.set(task.id, severityForTask(task, now));
  }

  await notifyNewlyEscalated(allTasks, severityByTaskId);
}

async function notifyNewlyEscalated(tasks, severityByTaskId) {
  const { [NOTIFIED_SEVERITY_KEY]: previouslyNotified = {} } = await chrome.storage.local.get(
    NOTIFIED_SEVERITY_KEY
  );
  const nextNotified = {};

  for (const task of tasks) {
    const severity = severityByTaskId.get(task.id);
    nextNotified[task.id] = severity;

    if (severity === SEVERITY.NONE) continue;
    if (previouslyNotified[task.id] === severity) continue; // already notified at this tier

    const copy = NOTIFICATION_COPY[severity]?.(task.title || "Untitled task");
    if (!copy) continue;

    chrome.notifications.create(`gtx-${task.id}-${severity}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: copy.title,
      message: copy.message,
      priority: copy.priority,
    });
  }

  await chrome.storage.local.set({ [NOTIFIED_SEVERITY_KEY]: nextNotified });
}
