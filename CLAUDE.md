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

- **Work in small increments.** One logical change at a time, roughly
  30-80 lines. Never dump a large amount of code at once.
- **I type the code, not you.** Give me the code to type, explain what each
  part does and why, then wait. Don't write directly to source files unless
  I explicitly ask. Explaining the reasoning is the point of this project.
- **Stop after each increment** so I can run it, understand it, and commit.
  Don't chain multiple stages together.
- **Tell me what to test.** After each increment, give me one or two things
  to try that would reveal whether I actually understood it, including
  things that break on purpose.
- **Explain tradeoffs, not just solutions.** When there's more than one way,
  say what the options are and why one wins.
- **Push back on me.** If I ask for something that's a bad idea or bigger
  than it needs to be, say so.

## Git

- I write and run my own commits. Don't commit for me unless I ask.
- No attribution trailers. No "Generated with Claude Code", no
  "Co-Authored-By", no session links in commit messages.
- Commit messages: imperative mood, describe what the change does.
  "Add fault reporting" not "Added fault reporting" and not "wip".
- Suggest a commit message after each increment. I'll run it.

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

Built in stages so far:

1. Static room layout with twelve tiles
2. Machine states with colored tiles (STATES lookup, CSS custom properties)
3. Live clock via useState + useEffect, elapsed time per machine
4. Detail sheet on tap, state lifted to parent, openId stored not the object

Remaining:

5. Fault reporting — MACHINES must become React state, not a module constant
6. Watch a machine and get notified when it finishes
7. Simulated sensor traffic so states change on their own
8. Header summary count that excludes machines with no signal
9. Replace fake data with a real API

## Current problem

The layout is rendering wrong. The CSS was built up across stages and rules
may be missing or duplicated. Check `web/src/TowleLaundry.css` against what
`TowleLaundry.jsx` actually uses before changing any JSX.