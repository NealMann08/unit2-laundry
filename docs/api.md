# API contract

Status: draft. Nothing implements the server side yet.

Three participants: the **sensor** (ESP32 on a machine), the **server**, and
the **browser**. The sensor and the browser never talk to each other.

    sensor  --POST /api/report-->  server  <--GET /api/machines--  browser
                                     ^                                |
                                     +-------POST /api/reports--------+

## Design rules this contract follows

**The server owns every timestamp.** An ESP32 has no real-time clock; after a
power blip it believes it is January 1970. Sensors therefore send no times at
all — the server records when a report *arrived*. This also means a machine's
`since` is the server's record of a transition, which is exactly what
`docs/design.md` section 2.2 assumes.

**The sensor classifies, the server derives.** The sensor sends `idle` or
`running` only. `stopped` is derived by the server from a running→idle
transition, and `no signal` is derived by whoever is reading from `lastSeen`.
Neither is ever sent over the wire as a sensed state.

**A fault is not a state.** Faults come from residents, live in `reports`,
and travel alongside the sensed state rather than replacing it. A machine can
be flagged and running simultaneously — required, because that's what the
auto-clear rule watches for.

## Sensor → server

    POST /api/report
    Authorization: Bearer <per-device token>
    Content-Type: application/json

```json
{
  "machine": "W3",
  "state": "running",
  "rms": 0.418,
  "peak_hz": 11.7,
  "fw": "0.1.0"
}
```

| Field | Required | Notes |
|---|---|---|
| `machine` | yes | Must match a machine the server knows |
| `state` | yes | `idle` or `running`. Nothing else is a sensed state |
| `rms` | no | Diagnostic. Log it — it's the training data for a better classifier |
| `peak_hz` | no | Diagnostic. Dominant FFT bin |
| `fw` | no | Firmware version, so a bad rollout is identifiable |

Response `204 No Content` on success. The device does not need a body and
should not wait for one.

Reports arrive roughly every 30 seconds. `rms` and `peak_hz` are optional but
worth sending from day one: once real cycles are running you will want the
recorded feature values to check the threshold against, and you cannot go
back in time to collect them.

Each device gets its own bearer token. Without it, anyone on the campus
network can mark every machine free.

## Server → browser

    GET /api/machines

```json
{
  "at": 1758067200000,
  "machines": [
    {
      "id": "W1",
      "kind": "washer",
      "tier": null,
      "state": "running",
      "since": 1758065880000,
      "lastSeen": 1758067190000,
      "reports": [{ "by": "r-8f2a41", "at": 1757900000000 }]
    }
  ]
}
```

| Field | Notes |
|---|---|
| `at` | Server clock when the response was built. The browser anchors to this |
| `id` | `W1`–`W6`, `D1`–`D6` |
| `kind` | `washer` or `dryer` |
| `tier` | `top` or `bottom` for dryers, `null` for washers |
| `state` | `free`, `running`, or `stopped`. Derived; see below |
| `since` | When the machine entered `state` |
| `lastSeen` | When this machine's sensor last reported |
| `reports` | Unexpired fault reports, newest last |

`state` maps from sensed states as follows: `running` passes through; `idle`
becomes `stopped` if the machine was running within the last N minutes, and
`free` otherwise. N is not yet decided — see open questions.

The browser polls this every 10 seconds and interpolates `at` forward locally
between polls, so elapsed counters tick once a second regardless. Do not add
a push channel for this; the underlying data is already up to 30 seconds old.

## Browser → server

    POST /api/reports
    Content-Type: application/json

```json
{ "machine": "W4", "by": "r-8f2a41" }
```

`by` is an anonymous per-browser id from `localStorage`. It exists only so
the two-distinct-reporters rule has something to compare, and is deliberately
not tied to any identity.

The server stamps `at`, applies the rules in `docs/design.md` section 7, and
returns `204`. Re-reporting by the same `by` within the TTL is a no-op, not
an error.

## Rules the server must enforce

These currently live in `web/src/faults.js` and are duplicated client-side
for responsiveness. The server is the authority.

- Two **distinct** `by` values within 24 hours **of each other** flags a
  machine. One person reporting twice never does.
- Reports expire 7 days after they are filed.
- A flagged machine that completes a full normal-length cycle has its reports
  cleared.

Client-side copies are for optimistic UI only. A client that disagrees with
the server loses on the next poll.

## Not in this contract yet

**Web Push.** Getting told a load finished with the page closed needs a
service worker, a push subscription stored server-side, and VAPID keys. On
iOS the site must also be installed to the home screen first. Until then the
browser only alerts while the page is open.

**Machine registry.** The twelve machines are currently hardcoded in the
client. The server should own this list and the client should render whatever
it receives.

## Open questions

1. How long after a cycle ends does a machine go from `stopped` to `free`?
   It cannot be sensed — there is no door sensor — so it is a guess about
   human behaviour. Measure it before picking a number.
2. Does the server store a rolling window of `rms` per machine for retraining,
   and if so for how long?
3. What happens when a sensor reports a machine id the server doesn't know —
   reject, or auto-register for easier deployment?
