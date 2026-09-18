// Fault rules. These are domain rules, not UI rules — the simulator (and
// later the server) needs them too, so they don't live in the component.
//
// See docs/design.md section 7. The two numbers do different jobs:
//   FAULT_WINDOW  how close two reports must land to corroborate each other
//   REPORT_TTL    how long a report stays valid once filed

export const DAY = 24 * 60 * 60 * 1000;
export const REPORT_TTL = 7 * DAY;
export const FAULT_WINDOW = DAY;

export function liveReports(machine, t) {
  return machine.reports.filter((r) => t - r.at < REPORT_TTL);
}

// Two distinct residents reporting within 24 hours of each other. The
// a.by !== b.by test is the whole anti-abuse mechanism: one person reporting
// twice compares against themselves and fails.
export function isOutOfOrder(machine, t) {
  const live = liveReports(machine, t);
  return live.some((a) =>
    live.some((b) => a.by !== b.by && Math.abs(a.at - b.at) < FAULT_WINDOW)
  );
}

// Adding a report, with expired ones pruned on write so the array can't grow
// without bound. Returns a new machine object; never mutates.
export function addReport(machine, by, at) {
  const live = machine.reports.filter((r) => at - r.at < REPORT_TTL);
  if (live.some((r) => r.by === by)) return { ...machine, reports: live };
  return { ...machine, reports: [...live, { by, at }] };
}
