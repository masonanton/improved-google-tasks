# Improved Google Tasks

A Chrome extension that adds to Google Tasks:
1. **Progress bars** — track a completion % per task (Phase 2, built)
2. **Deadline countdowns** — escalating badge + desktop notification alerts as due dates approach (Phase 1, built)
3. **In-progress list** — a cross-list view of tasks you've flagged as active (coming in Phase 3)

It works via Google's official Tasks API, shown in the extension's own side panel — not by modifying Google's actual Tasks page (see the plan/context for why).

## One-time setup

### 1. Load the extension (to get its extension ID)
1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this project folder.
4. Copy the **ID** shown on the extension's card (a long lowercase string) — you'll need it next.

### 2. Create a Google Cloud OAuth client
1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a new project (or reuse one you don't mind using for this).
2. Go to **APIs & Services > Library**, search for **Google Tasks API**, and click **Enable**.
3. Go to **APIs & Services > OAuth consent screen**:
   - User type: **External** is fine (you'll add yourself as a test user), or **Internal** if you have Google Workspace.
   - Fill in the required app name/support email fields.
   - Add scope `https://www.googleapis.com/auth/tasks`.
   - If prompted for test users, add your own Google account email.
4. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Chrome Extension**.
   - Item ID: paste the extension ID you copied in step 1.
5. Copy the generated **Client ID** (ends in `.apps.googleusercontent.com`).

### 3. Wire the client ID into the extension
1. Open `manifest.json`.
2. Replace `PASTE_YOUR_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com` with the client ID from step 2.
3. Back in `chrome://extensions`, click the **Reload** icon on this extension's card.

### 4. Sign in
1. Click the extension's toolbar icon to open the side panel.
2. Click **Sign in with Google** and approve the Tasks scope.

## What's built so far (Phase 0, 1 & 2)
- Auth + Tasks API plumbing (`lib/auth.js`, `lib/tasksApi.js`).
- Side panel listing all your task lists and open tasks, color-coded by how close each is to its due date.
- Background alarm (every 15 min) that:
  - Sets the toolbar badge color to the worst current due-date severity.
  - Fires a desktop notification the first time a task crosses into "due soon" (≤3 days), "due today", or "overdue" — won't re-notify repeatedly for the same tier.
- Progress bars: every task shows a completion-% bar under its title. Click a task to expand it and drag the slider to update progress — it's saved to the task's real Notes field (as a hidden `⟦gtx:...⟧` tag, your own note text is preserved and shown separately) via the Tasks API, so it syncs like any other edit.

Not built yet: the in-progress list (Phase 3).

## Manual test checklist
- [ ] Side panel opens from the toolbar icon and shows a working sign-in button when signed out.
- [ ] After sign-in, your real task lists and open tasks appear, matching tasks.google.com.
- [ ] A task due within 3 days shows a yellow "Due in N days" label; due today shows orange "Due today"; a past-due task shows red "Overdue by N days".
- [ ] Temporarily set a test task's due date to today (or move it to the past) in Google Tasks, then wait for the next alarm tick (or reload the extension to trigger an immediate check) — a desktop notification should appear once, and the toolbar badge should turn colored.
- [ ] Reloading again without the due date changing further should **not** produce a duplicate notification for the same task/tier.
- [ ] **Sign out** clears the panel and returns to the sign-in screen.
- [ ] Every task row shows a thin progress bar under its title (0% width if untouched).
- [ ] Clicking a task row expands a detail panel with a slider and current %.
- [ ] Dragging the slider and releasing it updates the bar immediately and saves — refresh the panel (or reload) to confirm it persisted.
- [ ] Open the same task in the real Google Tasks web app / mobile app — its Notes field should contain your original note text (if any) plus a `⟦gtx:p=NN...⟧` tag at the end.
- [ ] Editing that task's notes text directly in Google Tasks (leaving the tag alone) and reloading the extension panel should still show the correct progress and the edited note text.
