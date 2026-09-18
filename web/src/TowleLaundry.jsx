import { useState, useEffect } from "react";

import "./TowleLaundry.css";

const now = () => Date.now();
const mins = (n) => n * 60000;

const DAY = 24 * 60 * 60 * 1000;
const REPORT_TTL = 7 * DAY;
const FAULT_WINDOW = DAY;

function elapsed(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} hr ${m % 60} min`;
}

// A stable anonymous id for this browser, so the two-distinct-reporters rule
// has something to compare. Deliberately not crypto.randomUUID(), which is
// undefined outside a secure context — this has to work over plain http when
// testing from a phone on the dorm wifi.
function reporterId() {
  let id = localStorage.getItem("towle-reporter");
  if (!id) {
    id = `r-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("towle-reporter", id);
  }
  return id;
}

function liveReports(machine, t) {
  return machine.reports.filter((r) => t - r.at < REPORT_TTL);
}

// Two distinct residents reporting within 24 hours of each other marks a
// machine out of order. The pair has to be close in time to count as
// corroboration; the reports then stay valid until they expire at 7 days.
function isOutOfOrder(machine, t) {
  const live = liveReports(machine, t);
  return live.some((a) =>
    live.some((b) => a.by !== b.by && Math.abs(a.at - b.at) < FAULT_WINDOW)
  );
}

const STATES = {
  free:    { label: "Free",         color: "#0fa37f" },
  running: { label: "Running",      color: "#de7f16" },
  stopped: { label: "Stopped",      color: "#6558e0" },
  broken:  { label: "Out of order", color: "#9aa7b2" },
};

const INITIAL_MACHINES = [
  { id: "W1", kind: "washer", state: "running", since: now() - mins(22), reports: [] },
  { id: "W2", kind: "washer", state: "free", since: now() - mins(140), reports: [] },
  { id: "W3", kind: "washer", state: "running", since: now() - mins(4), reports: [] },
  { id: "W4", kind: "washer", state: "free", since: now() - mins(4000),
    reports: [
      { by: "r-8f2a41", at: now() - mins(2900) },
      { by: "r-c41b09", at: now() - mins(2760) },
    ] },
  { id: "W5", kind: "washer", state: "stopped", since: now() - mins(6), reports: [] },
  { id: "W6", kind: "washer", state: "free", since: now() - mins(300), reports: [] },
  { id: "D4", kind: "dryer", tier: "top", state: "running", since: now() - mins(31), reports: [] },
  { id: "D5", kind: "dryer", tier: "top", state: "stopped", since: now() - mins(14), reports: [] },
  { id: "D6", kind: "dryer", tier: "top", state: "free", since: now() - mins(200), reports: [] },
  { id: "D1", kind: "dryer", tier: "bottom", state: "running", since: now() - mins(12), reports: [] },
  { id: "D2", kind: "dryer", tier: "bottom", state: "free", since: now() - mins(88), reports: [] },
  { id: "D3", kind: "dryer", tier: "bottom", state: "free", since: now() - mins(45), reports: [] },
];

function Tile({ machine, t, onOpen }) {
  const faulted = isOutOfOrder(machine, t);
  const { label, color } = faulted ? STATES.broken : STATES[machine.state];
  const showTime =
    !faulted && (machine.state === "running" || machine.state === "stopped");

  return (
    <button
      className="tile"
      style={{ "--state-color": color }}
      onClick={() => onOpen(machine.id)}
    >
      <span className="tile-id">{machine.id}</span>
      <span className="tile-dot" />
      <span className="tile-label">{label}</span>
      <span className="tile-time">
        {showTime ? elapsed(t - machine.since) : ""}
      </span>
    </button>
  );
}

function Row({ label, value }) {
  return (
    <div className="sheet-row">
      <span className="sheet-key">{label}</span>
      <span className="sheet-value">{value}</span>
    </div>
  );
}

function Sheet({ machine, t, me, onClose, onReport }) {
  if (!machine) return null;

  const faulted = isOutOfOrder(machine, t);
  const { label, color } = faulted ? STATES.broken : STATES[machine.state];
  const kind = machine.kind === "washer" ? "Washer" : "Dryer";
  const tier = machine.tier === "top" ? "upper" : "lower";

  const live = liveReports(machine, t);
  const reporters = new Set(live.map((r) => r.by)).size;
  const mine = live.some((r) => r.by === me);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head" style={{ "--state-color": color }}>
          <span className="sheet-dot" />
          <div>
            <p className="sheet-title">
              {kind} {machine.id.slice(1)}
              {machine.tier && <span className="sheet-tier"> · {tier}</span>}
            </p>
            <p className="sheet-state">{label}</p>
          </div>
        </div>

        {machine.state === "stopped" && (
          <p className="sheet-caveat">
            The cycle ended {elapsed(t - machine.since)} ago. The sensor can't
            tell whether it's been emptied.
          </p>
        )}

        <div className="sheet-rows">
          {machine.state === "running" && (
            <Row label="Running for" value={elapsed(t - machine.since)} />
          )}
          {machine.state === "stopped" && (
            <Row label="Stopped" value={`${elapsed(t - machine.since)} ago`} />
          )}
          {machine.state === "free" && (
            <Row label="Idle for" value={elapsed(t - machine.since)} />
          )}
          {reporters > 0 && (
            <Row
              label="Problem reports"
              value={reporters === 1 ? "1 resident" : `${reporters} residents`}
            />
          )}
        </div>

        {reporters > 0 && (
          <p className="sheet-caveat">
            {faulted
              ? "Marked out of order. This clears if the machine runs a full cycle, or when the reports expire after 7 days."
              : "One report isn't enough. Another resident reporting within 24 hours marks it out of order."}
          </p>
        )}

        <button
          className="sheet-report"
          onClick={() => onReport(machine.id)}
          disabled={mine}
        >
          {mine ? "You reported this" : "Report a problem"}
        </button>

        <button className="sheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function TowleLaundry() {
  const [t, setT] = useState(now());
  const [machines, setMachines] = useState(INITIAL_MACHINES);
  const [me] = useState(reporterId);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setT(now()), 1000);
    return () => clearInterval(id);
  }, []);

  function reportFault(id) {
    const at = now();
    setMachines((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        // Prune expired reports on write so the array can't grow forever.
        const live = m.reports.filter((r) => at - r.at < REPORT_TTL);
        if (live.some((r) => r.by === me)) return { ...m, reports: live };
        return { ...m, reports: [...live, { by: me, at }] };
      })
    );
  }

  const washers = machines.filter((m) => m.kind === "washer");
  const dryersTop = machines.filter((m) => m.tier === "top");
  const dryersBottom = machines.filter((m) => m.tier === "bottom");

  const clock = new Date(t).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  const openMachine = machines.find((m) => m.id === openId);

  return (
    <div className="board">
      <header>
        <p className="building">Unit 2 Towle</p>
        <h1>Laundry</h1>
        <p className="updated">Updated {clock}</p>
      </header>

      <section>
        <h2>Washers</h2>
        <p className="note">Right wall as you walk in</p>
        <div className="washer-row">
          {washers.map((m) => (
            <Tile key={m.id} machine={m} t={t} onOpen={setOpenId} />
          ))}
        </div>
      </section>

      <section>
        <h2>Dryers</h2>
        <p className="note">Facing you, stacked two high</p>
        <div className="dryer-stack">
          <div className="dryer-row">
            {dryersTop.map((m) => (
              <Tile key={m.id} machine={m} t={t} onOpen={setOpenId} />
            ))}
          </div>
          <div className="dryer-row">
            {dryersBottom.map((m) => (
              <Tile key={m.id} machine={m} t={t} onOpen={setOpenId} />
            ))}
          </div>
        </div>
      </section>

      <Sheet
        machine={openMachine}
        t={t}
        me={me}
        onClose={() => setOpenId(null)}
        onReport={reportFault}
      />
    </div>
  );
}
