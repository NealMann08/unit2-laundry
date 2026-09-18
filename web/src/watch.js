// Watching a machine so the page can say something when it finishes.
//
// Scope, honestly: this only works while the page is open. The Notification
// API reaches you when the tab is backgrounded but the browser is running.
// Getting told about a finished load with the page fully closed needs Web
// Push — a service worker, a push subscription, and a server to push from —
// and on iOS it additionally requires the site to be installed to the home
// screen. That's server work, deferred.

const KEY = "towle-watched";

export function loadWatched() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    // Corrupt or unparseable — not worth failing the whole page over.
    return new Set();
  }
}

export function saveWatched(watched) {
  localStorage.setItem(KEY, JSON.stringify([...watched]));
}

// Notification is undefined in insecure contexts and in some in-app browsers,
// so every entry point has to tolerate it being missing.
export function notifyPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

// Must be called from a user gesture — browsers ignore permission requests
// that aren't traceable to a click.
export async function askToNotify() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function notify(title, body) {
  if (notifyPermission() !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.svg" });
  } catch {
    // Some browsers only allow notifications from a service worker. The
    // in-page banner is the fallback and always fires regardless.
  }
}
