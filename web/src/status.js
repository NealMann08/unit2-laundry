// What a machine should be *shown* as, which is not the same as what the
// sensor last said. Three things can claim a tile and they have to be ranked.

import { isOutOfOrder } from "./faults";

// docs/design.md section 2.3: sensors report every ~30s, so nothing heard in
// two minutes means four missed reports in a row. That's a dead sensor, not
// jitter.
export const STALE_AFTER = 2 * 60 * 1000;

export function isStale(machine, t) {
  return t - machine.lastSeen > STALE_AFTER;
}

// Precedence, most to least authoritative:
//
//   1. out of order — comes from residents, so it doesn't depend on the
//      sensor working. Still true even if the sensor is dead.
//   2. no signal — a dead sensor outranks whatever it said last, because a
//      stale reading is not evidence about right now.
//   3. whatever the sensor reported.
export function displayState(machine, t) {
  if (isOutOfOrder(machine, t)) return "broken";
  if (isStale(machine, t)) return "unknown";
  return machine.state;
}

// The rule from design.md — never claim a machine is free without evidence.
// Routing through displayState means staleness and faults are excluded by
// construction, rather than by remembering to filter for them at each call
// site.
export function countFree(machines, t) {
  return machines.filter((m) => displayState(m, t) === "free").length;
}

export function countUnknown(machines, t) {
  return machines.filter((m) => displayState(m, t) === "unknown").length;
}
