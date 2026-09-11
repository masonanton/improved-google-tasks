// Thin wrapper over the Google Tasks REST API (https://developers.google.com/tasks).
import { getAuthToken, clearCachedAuthToken } from "./auth.js";

const BASE = "https://www.googleapis.com/tasks/v1";

async function request(path, { method = "GET", body, params, interactive = true } = {}) {
  let token = await getAuthToken({ interactive });

  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }

  const doFetch = (tok) =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${tok}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch(token);

  if (res.status === 401) {
    // Cached token expired/revoked — drop it and retry once with a fresh one.
    await clearCachedAuthToken(token);
    token = await getAuthToken({ interactive });
    res = await doFetch(token);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tasks API ${method} ${path} failed: ${res.status} ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function listTaskLists({ interactive = true } = {}) {
  return request("/users/@me/lists", { params: { maxResults: 100 }, interactive }).then(
    (r) => r.items || []
  );
}

export function listTasks(
  tasklistId,
  { showCompleted = true, showHidden = true, interactive = true } = {}
) {
  return request(`/lists/${encodeURIComponent(tasklistId)}/tasks`, {
    params: { showCompleted, showHidden, maxResults: 100 },
    interactive,
  }).then((r) => r.items || []);
}

export function patchTask(tasklistId, taskId, patch) {
  return request(
    `/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "PATCH", body: patch }
  );
}

export function insertTask(tasklistId, task) {
  return request(`/lists/${encodeURIComponent(tasklistId)}/tasks`, {
    method: "POST",
    body: task,
  });
}

export function getTask(tasklistId, taskId) {
  return request(
    `/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(taskId)}`
  );
}

// Fetches every task list and its (incomplete, by default) tasks in one shot.
export async function listAllTasks({ showCompleted = false, interactive = true } = {}) {
  const lists = await listTaskLists({ interactive });
  const results = await Promise.all(
    lists.map(async (list) => ({
      list,
      tasks: await listTasks(list.id, { showCompleted, interactive }),
    }))
  );
  return results;
}
