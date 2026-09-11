# Unit 2 Laundry

A sensor system that can show which washers and dryers are free in Unit 2 Towle laundry room, so residents can check the availability of machines at their convenience.

## The Problem

Often times students go down to the laundry room and find machines either already in use or broken, causing them to have to go leave and try again later. This process currently has no way to know the state of the room without actively being in it, making it a hassle to get laundry done efficiently.

## How it works

Accelerometers are mounted on each machine and detect vibration of the machines, determining whether the machine is in active use or not. An ESP32 samples the sensor, computes an FFT, and classifies the machine as running or idle, then reports over WiFi. A web page will be employed to show live status for all twelve machines.

Six washers in a row on the right wall, and six dryers facing forward, stacked three wide and two high.

## Structure

- `docs/` — design document
- `firmware/` — ESP32 sensor code
- `analysis/` — signal analysis and classifier development
- `server/` — data ingest and API
- `web/` — React frontend

## Status

In development. Nothing works yet.