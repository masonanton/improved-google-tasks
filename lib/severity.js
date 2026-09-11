// Maps a task's due date to an escalating severity tier. Google Tasks due
// dates are date-only (midnight UTC) even though the API field is a
// timestamp, so we compare using UTC calendar dates rather than local time
// to match what Google's own UI shows as "days until due".

export const SEVERITY = {
  NONE: "none",
  SOON: "soon", // 1-3 days out
  URGENT: "urgent", // due today / within 24h
  OVERDUE: "overdue",
};

export const SEVERITY_ORDER = [
  SEVERITY.NONE,
  SEVERITY.SOON,
  SEVERITY.URGENT,
  SEVERITY.OVERDUE,
];

export const SEVERITY_COLOR = {
  [SEVERITY.NONE]: "#5f6368", // neutral gray
  [SEVERITY.SOON]: "#f9ab00", // yellow
  [SEVERITY.URGENT]: "#e8710a", // orange
  [SEVERITY.OVERDUE]: "#d93025", // red
};

function utcDateOnly(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Returns null if there's no due date (no alerting applicable).
export function daysUntilDue(dueIso, now = new Date()) {
  if (!dueIso) return null;
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((utcDateOnly(due) - utcDateOnly(now)) / msPerDay);
}

export function severityForTask(task, now = new Date()) {
  if (!task || task.status === "completed" || !task.due) return SEVERITY.NONE;
  const days = daysUntilDue(task.due, now);
  if (days === null) return SEVERITY.NONE;
  if (days < 0) return SEVERITY.OVERDUE;
  if (days === 0) return SEVERITY.URGENT;
  if (days <= 3) return SEVERITY.SOON;
  return SEVERITY.NONE;
}

export function worstSeverity(severities) {
  let worstIndex = 0;
  for (const s of severities) {
    const idx = SEVERITY_ORDER.indexOf(s);
    if (idx > worstIndex) worstIndex = idx;
  }
  return SEVERITY_ORDER[worstIndex];
}
