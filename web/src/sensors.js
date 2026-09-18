// A stand-in for the sensor network and the server behind it.
//
// Everything the UI knows about machines arrives through subscribe(). Phase 5
// replaces the guts of this file with fetch() against a real API and keeps the
// interface identical, so the component doesn't change.

import { addReport } from "./faults";

const mins = (n) => n * 60000;

// Simulated time runs fast so a 35-minute wash cycle is watchable. At 60, one
// real second is one simulated minute. Set to 1 for real-time behaviour.
export const SPEED = 60;

const TICK = 1000; // real milliseconds between simulator ticks

// Mean durations, in simulated time.
const RUN = { washer: mins(35), dryer: mins(45) };
const MEAN_UNLOAD = mins(9); // how long a finished load sits before pickup
const MEAN_IDLE = mins(90); // how long a free machine waits before someone starts it

// Sensors on these machines never report, so "no signal" is always visible
// somewhere in the room once phase 3 renders it.
const SILENT = new Set(["D6"]);

// The simulator keeps its own clock. Every timestamp the UI sees — including
// the current time — comes from here, which is also how the real system will
// work: the server stamps the times, because an ESP32 with no RTC can't be
// trusted to know what time it is.
let vnow = Date.now();

let machines = [
  { id: "W1", kind: "washer", state: "running", since: vnow - mins(22), lastSeen: vnow, reports: [] },
  { id: "W2", kind: "washer", state: "free", since: vnow - mins(140), lastSeen: vnow, reports: [] },
  { id: "W3", kind: "washer", state: "running", since: vnow - mins(4), lastSeen: vnow, reports: [] },
  { id: "W4", kind: "washer", state: "free", since: vnow - mins(4000), lastSeen: vnow,
    reports: [
      { by: "r-8f2a41", at: vnow - mins(2900) },
      { by: "r-c41b09", at: vnow - mins(2760) },
    ] },
  { id: "W5", kind: "washer", state: "stopped", since: vnow - mins(6), lastSeen: vnow, reports: [] },
  { id: "W6", kind: "washer", state: "free", since: vnow - mins(300), lastSeen: vnow, reports: [] },
  { id: "D4", kind: "dryer", tier: "top", state: "running", since: vnow - mins(31), lastSeen: vnow, reports: [] },
  { id: "D5", kind: "dryer", tier: "top", state: "stopped", since: vnow - mins(14), lastSeen: vnow, reports: [] },
  { id: "D6", kind: "dryer", tier: "top", state: "free", since: vnow - mins(200), lastSeen: vnow, reports: [] },
  { id: "D1", kind: "dryer", tier: "bottom", state: "running", since: vnow - mins(12), lastSeen: vnow, reports: [] },
  { id: "D2", kind: "dryer", tier: "bottom", state: "free", since: vnow - mins(88), lastSeen: vnow, reports: [] },
  { id: "D3", kind: "dryer", tier: "bottom", state: "free", since: vnow - mins(45), lastSeen: vnow, reports: [] },
];

// Real cycles aren't all the same length — load size and settings move it
// around. Without this every machine started at the same moment would also
// finish at the same moment, which never happens in a real laundry room.
function cycleLength(kind) {
  return RUN[kind] * (0.85 + Math.random() * 0.3);
}

// Probability of an event with mean wait `meanMs` happening during `dt`.
function chance(meanMs, dt) {
  return Math.random() < dt / meanMs;
}

function advance(m, dt) {
  const age = vnow - m.since;

  if (m.state === "running") {
    const full = m.cycle ?? RUN[m.kind];
    if (age < full) return m;
    // A flagged machine that completed a full normal-length cycle clears its
    // own reports — the auto-clear rule from design.md section 7. This is the
    // payoff of computing the fault instead of storing it: nothing has to go
    // find a flag and unset it.
    return { ...m, state: "stopped", since: vnow, cycle: null, reports: [] };
  }

  if (m.state === "stopped") {
    if (!chance(MEAN_UNLOAD, dt)) return m;
    return { ...m, state: "free", since: vnow };
  }

  if (m.state === "free") {
    if (!chance(MEAN_IDLE, dt)) return m;
    return { ...m, state: "running", since: vnow, cycle: cycleLength(m.kind) };
  }

  return m;
}

const listeners = new Set();
let timer = null;

function emit() {
  const snap = snapshot();
  for (const fn of listeners) fn(snap);
}

function tick() {
  const dt = TICK * SPEED;
  vnow += dt;
  machines = machines.map((m) => {
    const next = advance(m, dt);
    // A live sensor reports on every tick. A dead one reports nothing at all,
    // including the news that it is dead — which is exactly why staleness has
    // to be judged from the outside.
    return SILENT.has(m.id) ? next : { ...next, lastSeen: vnow };
  });
  emit();
}

// The current snapshot, synchronously. Lets the UI render real data on its
// very first paint instead of flashing an empty room for one frame.
// `online` exists to match the shape api.js returns — a simulator running in
// this tab can't be unreachable.
export function snapshot() {
  return { at: vnow, machines, online: true };
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(snapshot()); // don't make the caller wait a tick for data
  if (!timer) timer = setInterval(tick, TICK);

  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function reportFault(id, by) {
  machines = machines.map((m) => (m.id === id ? addReport(m, by, vnow) : m));
  emit();
}
