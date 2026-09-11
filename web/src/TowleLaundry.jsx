import "./TowleLaundry.css";

const STATES = {
  free:    { label: "Free",         color: "#0fa37f" },
  running: { label: "Running",      color: "#de7f16" },
  stopped: { label: "Stopped",      color: "#6558e0" },
  broken:  { label: "Out of order", color: "#9aa7b2" },
};

const MACHINES = [
  { id: "W1", kind: "washer", state: "running" },
  { id: "W2", kind: "washer", state: "free" },
  { id: "W3", kind: "washer", state: "running" },
  { id: "W4", kind: "washer", state: "broken" },
  { id: "W5", kind: "washer", state: "stopped" },
  { id: "W6", kind: "washer", state: "free" },
  { id: "D4", kind: "dryer", tier: "top", state: "running" },
  { id: "D5", kind: "dryer", tier: "top", state: "stopped" },
  { id: "D6", kind: "dryer", tier: "top", state: "free" },
  { id: "D1", kind: "dryer", tier: "bottom", state: "running" },
  { id: "D2", kind: "dryer", tier: "bottom", state: "free" },
  { id: "D3", kind: "dryer", tier: "bottom", state: "free" },
];

function Tile({ machine }) {
  const { label, color } = STATES[machine.state];

  return (
    <div className="tile" style={{ "--state-color": color }}>
      <span className="tile-id">{machine.id}</span>
      <span className="tile-dot" />
      <span className="tile-label">{label}</span>
    </div>
  );
}

export default function TowleLaundry() {
  const washers = MACHINES.filter((m) => m.kind === "washer");
  const dryersTop = MACHINES.filter((m) => m.tier === "top");
  const dryersBottom = MACHINES.filter((m) => m.tier === "bottom");

  return (
    <div className="board">
      <header>
        <p className="building">Unit 2 Towle</p>
        <h1>Laundry</h1>
      </header>

      <section>
        <h2>Washers</h2>
        <p className="note">Right wall as you walk in</p>
        <div className="washer-row">
          {washers.map((m) => (
            <Tile key={m.id} machine={m} />
          ))}
        </div>
      </section>

      <section>
        <h2>Dryers</h2>
        <p className="note">Facing you, stacked two high</p>
        <div className="dryer-stack">
          <div className="dryer-row">
            {dryersTop.map((m) => (
              <Tile key={m.id} machine={m} />
            ))}
          </div>
          <div className="dryer-row">
            {dryersBottom.map((m) => (
              <Tile key={m.id} machine={m} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}