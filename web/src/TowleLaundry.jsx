import { useState, useEffect, useRef } from "react";

import { liveReports } from "./faults";
import { displayState, isStale, countFree, countUnknown } from "./status";
import { subscribe, reportFault, snapshot as currentSnapshot } from "./sensors";
import {
  loadWatched,
  saveWatched,
  askToNotify,
  notifyPermission,
  notify,
} from "./watch";
import "./TowleLaundry.css";

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

const STATES = {
  free:    { label: "Free",         color: "#0fa37f" },
  running: { label: "Running",      color: "#de7f16" },
  stopped: { label: "Stopped",      color: "#6558e0" },
  broken:  { label: "Out of order", color: "#9aa7b2" },
  unknown: { label: "No signal",    color: "#b4c0c9" },
};

function Tile({ machine, t, watching, onOpen }) {
  const key = displayState(machine, t);
  const { label, color } = STATES[key];
  const showTime = key === "running" || key === "stopped";

  return (
    <button
      className={watching ? "tile tile--watched" : "tile"}
      style={{ "--state-color": color }}
      onClick={() => onOpen(machine.id)}
    >
      <span className="tile-id">{machine.id}</span>
      {/* Hollow dot for "no signal": filled means we know, outline means we
          don't. The shape carries the distinction, not just the colour. */}
      <span className={key === "unknown" ? "tile-dot tile-dot--hollow" : "tile-dot"} />
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

function Summary({ washers, dryers, machines, t }) {
  const unknown = countUnknown(machines, t);

  return (
    <div className="summary-block">
      <div className="summary">
        <div className="summary-item">
          <span className="summary-count">{countFree(washers, t)}</span>
          <span className="summary-label">washers free</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{countFree(dryers, t)}</span>
          <span className="summary-label">dryers free</span>
        </div>
      </div>

      {unknown > 0 && (
        <p className="summary-note">
          {unknown === 1
            ? "1 machine isn't reporting, so it isn't counted either way."
            : `${unknown} machines aren't reporting, so they aren't counted either way.`}
        </p>
      )}
    </div>
  );
}

function Alert({ ids, onDismiss }) {
  if (ids.length === 0) return null;

  return (
    <div className="alert">
      <p className="alert-text">
        <strong>{ids.join(", ")}</strong> finished.
      </p>
      <button className="alert-close" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

function Sheet({ machine, t, me, watching, onWatch, onClose, onReport }) {
  if (!machine) return null;

  const key = displayState(machine, t);
  const { label, color } = STATES[key];
  const kind = machine.kind === "washer" ? "Washer" : "Dryer";
  const tier = machine.tier === "top" ? "upper" : "lower";

  const live = liveReports(machine, t);
  const reporters = new Set(live.map((r) => r.by)).size;
  const mine = live.some((r) => r.by === me);
  const stale = isStale(machine, t);
  const permission = notifyPermission();

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head" style={{ "--state-color": color }}>
          <span className={key === "unknown" ? "sheet-dot sheet-dot--hollow" : "sheet-dot"} />
          <div>
            <p className="sheet-title">
              {kind} {machine.id.slice(1)}
              {machine.tier && <span className="sheet-tier"> · {tier}</span>}
            </p>
            <p className="sheet-state">{label}</p>
          </div>
        </div>

        {key === "unknown" && (
          <p className="sheet-caveat">
            This machine's sensor hasn't reported in{" "}
            {elapsed(t - machine.lastSeen)}. It could be free, running, or
            broken — there's no way to tell from here.
          </p>
        )}

        {key === "stopped" && (
          <p className="sheet-caveat">
            The cycle ended {elapsed(t - machine.since)} ago. The sensor can't
            tell whether it's been emptied.
          </p>
        )}

        <div className="sheet-rows">
          {key === "running" && (
            <Row label="Running for" value={elapsed(t - machine.since)} />
          )}
          {key === "stopped" && (
            <Row label="Stopped" value={`${elapsed(t - machine.since)} ago`} />
          )}
          {key === "free" && (
            <Row label="Idle for" value={elapsed(t - machine.since)} />
          )}
          {/* A flagged machine still reports, and what it reports is still
              worth showing — that's what the auto-clear rule watches. */}
          {key === "broken" && !stale && (
            <Row label="Sensor says" value={STATES[machine.state].label} />
          )}
          <Row
            label="Last reported"
            value={stale ? `${elapsed(t - machine.lastSeen)} ago` : "just now"}
          />
          {reporters > 0 && (
            <Row
              label="Problem reports"
              value={reporters === 1 ? "1 resident" : `${reporters} residents`}
            />
          )}
        </div>

        {key === "running" && (
          <>
            <button
              className={watching ? "sheet-watch sheet-watch--on" : "sheet-watch"}
              onClick={() => onWatch(machine.id)}
            >
              {watching ? "Watching this machine" : "Tell me when it finishes"}
            </button>
            {watching && (
              <p className="sheet-caveat">
                {permission === "granted"
                  ? "Keep this page open in a tab. You'll get a notification when the cycle ends."
                  : "Keep this page open. Notifications are off, so you'll see a banner here instead."}
              </p>
            )}
          </>
        )}

        {reporters > 0 && (
          <p className="sheet-caveat">
            {key === "broken"
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
  // One snapshot object rather than separate time and machine state, because
  // they always arrive together and must never be rendered out of step.
  // Passing the function itself, not calling it — React runs a lazy
  // initializer once, on the first render only.
  const [snapshot, setSnapshot] = useState(currentSnapshot);
  const [me] = useState(reporterId);
  const [openId, setOpenId] = useState(null);
  const [watched, setWatched] = useState(loadWatched);
  const [alerts, setAlerts] = useState([]);

  // Last state seen for each machine. Refs, not state: updating them must not
  // itself cause a render.
  const seen = useRef(new Map());
  // The subscription below is created once and never re-created, so it would
  // otherwise close over the first render's `watched` forever.
  const watchedNow = useRef(watched);
  useEffect(() => {
    watchedNow.current = watched;
  }, [watched]);

  // A machine finishing is an event from outside React, so it's detected where
  // the event arrives — in the subscription callback. Diffing rendered state
  // in an effect instead would mean a render caused by data, then a second
  // render caused by the first one noticing.
  useEffect(() => {
    return subscribe((snap) => {
      setSnapshot(snap);

      const prev = seen.current;
      const firstLook = prev.size === 0;
      const watching = watchedNow.current;
      const finished = [];
      const abandoned = [];

      for (const m of snap.machines) {
        const was = prev.get(m.id);
        prev.set(m.id, m.state);

        if (!watching.has(m.id)) continue;

        if (firstLook) {
          // Reloaded after the cycle already ended. We have no idea when that
          // happened, so drop the watch rather than fire a stale alert.
          if (m.state !== "running") abandoned.push(m.id);
        } else if (was === "running" && m.state !== "running") {
          finished.push(m.id);
        }
      }

      if (finished.length > 0 || abandoned.length > 0) {
        setWatched((w) => {
          const next = new Set(w);
          for (const id of [...finished, ...abandoned]) next.delete(id);
          return next;
        });
      }

      if (finished.length > 0) {
        setAlerts((a) => [...new Set([...a, ...finished])]);
        for (const id of finished) {
          notify(`${id} has finished`, "Your laundry is done.");
        }
      }
    });
  }, []);

  const { at: t, machines } = snapshot;

  // Persisted separately rather than inside the updater above — StrictMode
  // runs updaters twice, and a writer that runs twice is a writer with a bug.
  useEffect(() => {
    saveWatched(watched);
  }, [watched]);

  async function toggleWatch(id) {
    const next = new Set(watched);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      // Piggyback on this click: browsers ignore permission requests that
      // aren't traceable to a user gesture.
      await askToNotify();
    }
    setWatched(next);
  }

  const washers = machines.filter((m) => m.kind === "washer");
  const dryers = machines.filter((m) => m.kind === "dryer");
  const dryersTop = dryers.filter((m) => m.tier === "top");
  const dryersBottom = dryers.filter((m) => m.tier === "bottom");

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

      <Alert ids={alerts} onDismiss={() => setAlerts([])} />

      <Summary washers={washers} dryers={dryers} machines={machines} t={t} />

      <section>
        <h2>Washers</h2>
        <p className="note">Right wall as you walk in</p>
        <div className="washer-row">
          {washers.map((m) => (
            <Tile
              key={m.id}
              machine={m}
              t={t}
              watching={watched.has(m.id)}
              onOpen={setOpenId}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Dryers</h2>
        <p className="note">Facing you, stacked two high</p>
        <div className="dryer-stack">
          <div className="dryer-row">
            {dryersTop.map((m) => (
              <Tile
                key={m.id}
                machine={m}
                t={t}
                watching={watched.has(m.id)}
                onOpen={setOpenId}
              />
            ))}
          </div>
          <div className="dryer-row">
            {dryersBottom.map((m) => (
              <Tile
                key={m.id}
                machine={m}
                t={t}
                watching={watched.has(m.id)}
                onOpen={setOpenId}
              />
            ))}
          </div>
        </div>
      </section>

      <Sheet
        machine={openMachine}
        t={t}
        me={me}
        watching={openMachine ? watched.has(openMachine.id) : false}
        onWatch={toggleWatch}
        onClose={() => setOpenId(null)}
        onReport={(id) => reportFault(id, me)}
      />
    </div>
  );
}
