// Maps a task's due date to an escalating severity tier. Google Tasks due
// dates are date-only, stored as midnight UTC of the intended calendar day
// (so the "day" itself is fixed no matter who reads it back) — we read that
// side with the UTC getters. "Today", on the other hand, must be read with
// the LOCAL getters: comparing two UTC-shifted values would silently roll
// "today" over to tomorrow every evening for anyone west of UTC (e.g. in
// the evening in US time zones), making every countdown off by a day.
export const SEVERITY = {
  NONE: "none",
  SOON: "soon", // 1-3 days out
  URGENT: "urgent", // due today / within 24h
  OVERDUE: "overdue",
};

function dueDateOnlyAsUtcMs(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function localDateOnlyAsUtcMs(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

// Returns null if there's no due date (no alerting applicable).
export function daysUntilDue(dueIso, now = new Date()) {
  if (!dueIso) return null;
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((dueDateOnlyAsUtcMs(due) - localDateOnlyAsUtcMs(now)) / msPerDay);
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

// Continuous color gradient for UI display, independent of the discrete
// tiers above (which drive notifications/badge and intentionally stay
// coarse to avoid notification spam). Intensity increases smoothly as a
// task's due date approaches within 7 days, then keeps deepening into
// overdue territory (capped at 7 days overdue).
const DUE_COLOR_STOPS = [
  { days: 7, rgb: [253, 214, 99] }, // soft yellow — edge of the 7-day window
  { days: 3, rgb: [249, 171, 0] }, // amber
  { days: 1, rgb: [232, 113, 10] }, // orange
  { days: 0, rgb: [217, 48, 37] }, // red — due today
  { days: -7, rgb: [127, 0, 0] }, // dark maroon — a week+ overdue
];

// Returns a CSS color string, or null if the task is outside the window
// (due date more than 7 days away, or no due date at all).
export function dueDateColor(dueIso, now = new Date()) {
  const days = daysUntilDue(dueIso, now);
  if (days === null || days > 7) return null;

  for (let i = 0; i < DUE_COLOR_STOPS.length - 1; i++) {
    const a = DUE_COLOR_STOPS[i];
    const b = DUE_COLOR_STOPS[i + 1];
    if (days <= a.days && days >= b.days) {
      const span = a.days - b.days;
      const t = span === 0 ? 0 : (a.days - days) / span;
      return rgbToCss(lerpRgb(a.rgb, b.rgb, t));
    }
  }
  // More than 7 days overdue: clamp to the darkest stop.
  return rgbToCss(DUE_COLOR_STOPS[DUE_COLOR_STOPS.length - 1].rgb);
}

function lerpRgb(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

function rgbToCss([r, g, b]) {
  return `rgb(${r}, ${g}, ${b})`;
}
