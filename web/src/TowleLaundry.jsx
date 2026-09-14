import { useState, useEffect } from "react";

import "./TowleLaundry.css";

const now = () => Date.now();
const mins = (n) => n * 60000;

function elapsed(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} hr ${m % 60} min`;
}

const STATES = {
  free:    { label: "Free",         color: "#0fa37f" },
  running: { label: "Running",      color: "#de7f16" },
  stopped: { label: "Stopped",      color: "#6558e0" },
  broken:  { label: "Out of order", color: "#9aa7b2" },
};

const MACHINES = [
  { id: "W1", kind: "washer", state: "running", since: now() - mins(22) },
  { id: "W2", kind: "washer", state: "free", since: now() - mins(140) },
  { id: "W3", kind: "washer", state: "running", since: now() - mins(4) },
  { id: "W4", kind: "washer", state: "broken", since: now() - mins(4000) },
  { id: "W5", kind: "washer", state: "stopped", since: now() - mins(6) },
  { id: "W6", kind: "washer", state: "free", since: now() - mins(300) },
  { id: "D4", kind: "dryer", tier: "top", state: "running", since: now() - mins(31) },
  { id: "D5", kind: "dryer", tier: "top", state: "stopped", since: now() - mins(14) },
  { id: "D6", kind: "dryer", tier: "top", state: "free", since: now() - mins(200) },
  { id: "D1", kind: "dryer", tier: "bottom", state: "running", since: now() - mins(12) },
  { id: "D2", kind: "dryer", tier: "bottom", state: "free", since: now() - mins(88) },
  { id: "D3", kind: "dryer", tier: "bottom", state: "free", since: now() - mins(45) },
];

function Tile({ machine, t, onOpen }) {
  const { label, color } = STATES[machine.state];
  const showTime = machine.state === "running" || machine.state === "stopped";

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

function Sheet({ machine, t, onClose }) {
  if (!machine) return null;

  const { label, color } = STATES[machine.state];
  const kind = machine.kind === "washer" ? "Washer" : "Dryer";
  const tier = machine.tier === "top" ? "upper" : "lower";

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
        </div>

        <button className="sheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function TowleLaundry() {
  const [t, setT] = useState(now());

  useEffect(() => {
    const id = setInterval(() => setT(now()), 1000);
    return () => clearInterval(id);
  }, []);

  const washers = MACHINES.filter((m) => m.kind === "washer");
  const dryersTop = MACHINES.filter((m) => m.tier === "top");
  const dryersBottom = MACHINES.filter((m) => m.tier === "bottom");

  const clock = new Date(t).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  const [openId, setOpenId] = useState(null);
  const openMachine = MACHINES.find((m) => m.id === openId);
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
      <Sheet machine={openMachine} t={t} onClose={() => setOpenId(null)} />
      
    </div>
  );
}