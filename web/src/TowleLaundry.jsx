import "./TowleLaundry.css";

const WASHERS = ["W1", "W2", "W3", "W4", "W5", "W6"];
const DRYERS_TOP = ["D4", "D5", "D6"];
const DRYERS_BOTTOM = ["D1", "D2", "D3"];

function Tile({ id }) {
  return <div className="tile">{id}</div>;
}

export default function TowleLaundry() {
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
          {WASHERS.map((id) => (
            <Tile key={id} id={id} />
          ))}
        </div>
      </section>

      <section>
        <h2>Dryers</h2>
        <p className="note">Facing you, stacked two high</p>
        <div className="dryer-stack">
          <div className="dryer-row">
            {DRYERS_TOP.map((id) => (
              <Tile key={id} id={id} />
            ))}
          </div>
          <div className="dryer-row">
            {DRYERS_BOTTOM.map((id) => (
              <Tile key={id} id={id} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}