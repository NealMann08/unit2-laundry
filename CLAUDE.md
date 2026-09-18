# Unit 2 Laundry

## What this is

A sensor system for the laundry room in Unit 2 Towle at UC Berkeley. Six
washers in a row on the right wall, six dryers facing forward stacked three
wide and two high. Accelerometers on each machine detect vibration; an ESP32
samples the sensor, computes an FFT, classifies running vs idle, and reports
over WiFi. A web page shows live status.

Built by Neal Mann, first-year applied math and physics major. The goal is
both a working system and genuinely understanding how it works.

## How I want to work

This is the most important section. Follow it.

- **You write the code.** Edit the source files directly. I review and
  commit. I don't type it in myself.
- **Work in phases.** One coherent feature per phase. Finish the phase
  across however many files it touches, then stop.
- **Stop after each phase** so I can run it and commit. Don't chain
  multiple phases together.
- **Explain the reasoning anyway.** After each phase, say what changed and
  why it's built that way. Understanding how the system works is still a
  goal of this project even though I'm not typing the code.
- **Tell me what to test.** One or two things to try, including something
  that breaks on purpose to show what a rule is actually doing.
- **Explain tradeoffs, not just solutions.** When there's more than one way,
  say what the options are and why one wins.
- **Push back on me.** If I ask for something that's a bad idea or bigger
  than it needs to be, say so.

## Git

- I run my own commits. Don't commit or push for me unless I ask.
- After each phase, give me the exact git commands to stage, commit, and
  push, ready to paste.
- No attribution trailers. No "Generated with Claude Code", no
  "Co-Authored-By", no session links in commit messages.
- Commit messages: imperative mood, describe what the change does.
  "Add fault reporting" not "Added fault reporting" and not "wip".

## Stack

- Frontend: React 19 + Vite, plain CSS, no UI library
- Firmware: ESP32 (ESP32-WROOM-32) with MPU-6050 accelerometer, Arduino/C++
- Analysis: Python, NumPy, Jupyter
- Server: not built yet, likely Python FastAPI

## Structure

- `docs/design.md` — design document, requirements, decisions and reasoning
- `web/` — React frontend
- `firmware/sensor/` — ESP32 code (empty)
- `analysis/` — signal analysis notebooks (empty)
- `server/` — ingest and API (empty)

## Design decisions already made

Read `docs/design.md` for the full reasoning. Summary:

- **Accelerometer**, not current clamp (permissions), not microphone
  (source separation is too hard, privacy problem), not camera.
- **Two sensed states only**: idle and running. The classifier does not
  distinguish anything else.
- **"Stopped" is derived, not sensed.** The server sees a running-to-idle
  transition and knows when. The sensor cannot detect whether clothes are
  still inside, and the UI must not claim otherwise.
- **Elapsed time, not remaining.** Time remaining needs cycle phase and
  user setting, neither of which the sensor can see.
- **A machine with no recent sensor report is not counted as free.** A dead
  sensor and an idle machine look identical. Never claim free without
  evidence.
- **Faults need two distinct reports** within 24 hours, so one person can't
  flag every machine. Reports expire after 7 days. Sensor auto-clears a
  fault if the machine later runs a full normal cycle.
- **Try the simple thing first.** An RMS threshold may separate idle from
  running with no machine learning at all. Check before adding a model.

## Where the frontend is

Built so far:

1. Static room layout with twelve tiles
2. Machine states with colored tiles (STATES lookup, CSS custom properties)
3. Live clock via useState + useEffect, elapsed time per machine
4. Detail sheet on tap, state lifted to parent, openId stored not the object
5. Fault reporting. Each machine carries a `reports` array; out-of-order is
   computed by `isOutOfOrder`, not stored.
6. Simulated sensor traffic. `sensors.js` owns all machine data and pushes
   snapshots; the component subscribes and renders whatever arrives.
7. "No signal" for stale sensors, and a summary count that excludes it.
8. Watch a running machine. In-page banner plus a Notification if permitted.
   Only works while the page is open — real background delivery needs Web
   Push, which needs the server.

Remaining phases:

9. Swap the simulator's internals for fetch against a real server

### Frontend files

- `TowleLaundry.jsx` — all rendering. Owns no machine data.
- `sensors.js` — the data source. Currently a simulator; phase 9 replaces
  its internals with `fetch` and keeps `subscribe` / `snapshot` /
  `reportFault` identical.
- `faults.js` — fault rules, shared by the UI and the data source.
- `status.js` — what a machine is *displayed* as. `displayState` ranks
  out-of-order over no-signal over the sensed state, and everything that
  asks "is this free" goes through it so the never-claim-free-without-
  evidence rule can't be forgotten at a call site.
- `watch.js` — watched-machine persistence and the Notification API, with
  every entry point tolerating `Notification` being undefined.

Time in the app comes from the snapshot (`snapshot.at`), never from
`Date.now()` in a component. The simulator runs a fast virtual clock, and
the real server will stamp times too, since an ESP32 with no RTC can't be
trusted to know what time it is.

## How fault state is modelled

"Out of order" is not a machine state. The sensed states are idle and
running; stopped is derived. A fault is a separate layer computed from
resident reports, because a machine can be flagged *and* running at the
same time — which is what lets the sensor auto-clear a fault by observing a
full cycle.

Two distinct reporters within 24 hours *of each other* trips the fault. The
24 hours is how close two reports must be to corroborate; the 7-day expiry
is how long that corroboration stays valid. A fault does not clear itself
overnight just because nobody reported again.