// Thin wrapper around chrome.identity for the Google Tasks OAuth token.

export function getAuthToken({ interactive = true } = {}) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError || new Error("No token returned"));
        return;
      }
      resolve(token);
    });
  });
}

export function clearCachedAuthToken(token) {
  return new Promise((resolve) => {
    if (!token) {
      resolve();
      return;
    }
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

// Sign out: drop the cached token and revoke it with Google so the next
// getAuthToken() forces a fresh interactive sign-in.
export async function signOut() {
  const token = await getAuthToken({ interactive: false }).catch(() => null);
  if (!token) return;
  await clearCachedAuthToken(token);
  await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
}
