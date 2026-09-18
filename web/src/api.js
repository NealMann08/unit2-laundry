// The real client. Same interface as sensors.js — subscribe / snapshot /
// reportFault — so the component can't tell which one it's talking to.
//
// The wire format is documented in docs/api.md.

import { addReport } from "./faults";

const BASE = import.meta.env.VITE_API_URL ?? "";

const POLL = 10000; // ms between network fetches
const TICK = 1000; // ms between emitted frames

let machines = [];
let serverAt = 0; // the server's clock as of the last successful poll
let localAt = 0; // this browser's clock at that same moment
let online = false;

// Interpolate the server's clock forward using local elapsed time.
//
// Two things fall out of this. Polling every 10s while emitting every 1s
// keeps the elapsed counters smooth without hammering the server — the
// network rate and the display rate are independent. And anchoring to the
// server's clock means a laptop with the wrong time still shows correct
// elapsed values, because only the *difference* since the last poll comes
// from the local clock.
function now() {
  if (localAt === 0) return Date.now(); // nothing fetched yet
  return serverAt + (Date.now() - localAt);
}

export function snapshot() {
  return { at: now(), machines, online };
}

const listeners = new Set();
let pollTimer = null;
let tickTimer = null;

function emit() {
  const snap = snapshot();
  for (const fn of listeners) fn(snap);
}

async function poll() {
  try {
    const res = await fetch(`${BASE}/api/machines`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    machines = data.machines;
    serverAt = data.at;
    localAt = Date.now();
    online = true;
  } catch {
    // Keep the last snapshot rather than blanking the screen. The
    // interpolated clock keeps advancing while lastSeen doesn't, so every
    // machine ages into "no signal" within two minutes on its own. A server
    // we can't reach should look exactly like sensors we can't hear, because
    // from the user's side it is the same thing: we don't know.
    online = false;
  }
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(snapshot());

  if (!pollTimer) {
    poll();
    pollTimer = setInterval(poll, POLL);
    tickTimer = setInterval(emit, TICK);
  }

  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      clearInterval(pollTimer);
      clearInterval(tickTimer);
      pollTimer = null;
      tickTimer = null;
    }
  };
}

export async function reportFault(id, by) {
  // Applied locally first. The button has to respond to the tap immediately,
  // not after a round trip over dorm wifi. The next poll reconciles against
  // whatever the server actually recorded — including, if the POST failed,
  // quietly dropping the report again.
  machines = machines.map((m) => (m.id === id ? addReport(m, by, now()) : m));
  emit();

  try {
    await fetch(`${BASE}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machine: id, by }),
    });
  } catch {
    // Nothing to do here — poll() below is the reconciliation.
  }

  poll();
}
