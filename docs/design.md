# Unit 2 Laundry — Design Document

Author: Neal Mann
Status: Draft

## 1. Problem

### 1.1 What's wrong

College students already juggle a lot, and laundry becomes an unnecessary
burden when it can't be planned. Students walk down to the machines, find
every machine either taken or broken, and have to go back up and try again
later. The trip is wasted and there's no way to avoid it.

### 1.2 Who has this problem

- Residents in building: 100-200
- Machines: 6 washers, 6 dryers
- Loads per day: unknown, needs measuring

### 1.3 What people do today

Walk down to the laundry floor and look.

### 1.4 Why this doesn't already exist

There may be a vendor app, but students don't use it. TODO: find the vendor
sticker on the machines, identify the app, try it, and ask three residents
whether they use it and why not.

## 2. Requirements

### 2.1 Capabilities

| Capability | Required | Why |
|---|---|---|
| Which washers are free | Yes | The core problem |
| Which dryers are free | Yes | Same |
| Time elapsed on a running machine | Yes (v1) | Cheap: derived from the state transition timestamp |
| Time remaining | No | Requires knowing cycle phase and setting, which the sensor can't see |
| Notify when a load finishes | Yes | Requires a claim step so the system knows whose load it is |
| Predict busy times | No | Phase 2 |
| Track how long machines sit full | No | Not detectable without a door sensor |

### 2.2 States

Sensed states: idle / running. Two classes, from vibration.

Derived state: stopped. Not sensed. The server sees a running-to-idle
transition and knows how long ago it happened. The sensor cannot detect
whether clothes are still inside.

### 2.3 Freshness

Acceptable staleness: 1 minute. Sensors report roughly every 30 seconds.
A machine that hasn't reported in 2 minutes shows "no signal" and is not
counted as free.

### 2.4 Which failure is worse

TODO. Says-free-when-busy costs someone a wasted trip and their trust in
the system. Says-busy-when-free costs an idle machine. Decide which
matters more; it sets the classifier threshold and the metric to report.

### 2.5 Non-goals

- Predicting busy times
- Booking or reservation system
- Automatic broken-machine detection
- Any building other than Unit 2 Towle
- A native mobile app

## 3. Sensing approach

Chosen: accelerometer mounted on each machine.

Rejected:
- Current clamp: most accurate, but requires access to machine wiring.
  Permission and safety blocker.
- Microphone: one device covers the room, but attributing sound to a
  specific machine is source separation, a research problem. Also a
  privacy problem in a shared residential space.
- Magnetometer: non-contact but extremely placement sensitive.
- Reed switch on the door: reliable but only detects doors, not cycles.
  Worth revisiting as a second sensor to detect emptying.
- Camera: not acceptable in a laundry room.

## 4. Hardware

| Part | Choice | Reason |
|---|---|---|
| Accelerometer | MPU-6050 | Cheapest, best documented, library support means problems are searchable |
| Microcontroller | ESP32 | WiFi plus a hardware FPU and enough RAM for on-device FFT |
| Power | TODO | Depends on laundry room outlet survey |
| Mounting | Neodymium magnets | Machines are steel. Nothing adhesive, removable in seconds |

Rejected microcontrollers: Arduino Uno has no WiFi and no floating point.
ESP8266 has WiFi but no FPU, so FFT is slow. Raspberry Pi is a full Linux
computer for one sensor, draws too much power for battery, and corrupts its
SD card on unexpected power loss.

## 5. Pipeline

    Accelerometer -> Sampling -> Windowing -> FFT -> Features -> Classifier -> State

Sampling: washer drum spins at roughly 600-1200 RPM, so 10-20 Hz
fundamental plus harmonics. TODO: fix the sample rate. Nyquist sets the
floor; aliasing folds high frequencies down into fake low ones with no
error message.

Windowing: longer window gives finer frequency resolution but worse time
resolution. Resolution equals sample rate divided by window length.

Why FFT: in the time domain a washer and a dryer are both wiggly lines and
a classifier would have to learn wiggle shapes from a small dataset. In the
frequency domain their energy sits in different bands and they become
nearly separable. Choosing the representation does most of the classifier's
work.

Classifier: try an RMS threshold first. Idle versus running may separate on
a single number, in which case v1 needs no machine learning at all.

## 6. Data to collect

| Recording | Duration | Purpose |
|---|---|---|
| Full wash cycle | ~35 min | Positive class |
| Full dry cycle | ~45 min | Different signature |
| Idle machine | 30 min | Negative class |
| Idle while neighbor runs | 30 min | The hard case, source of false positives |
| Door slams, loading | 10 min | Transients that must not misclassify |

## 7. Fault reporting

A machine is marked out of order when two distinct residents report it
within 24 hours **of each other**. Single reports are insufficient because
one person could flag every machine to keep the room free.

The two numbers do different jobs and are easy to confuse:

- **24 hours** is how close together two reports must land to count as
  corroborating each other.
- **7 days** is how long a report stays valid once filed.

So the fault latches. It does not clear itself after 24 hours merely
because nobody reported again; it clears when the underlying reports expire
at 7 days, or earlier if the sensor observes a complete normal-length cycle
on a flagged machine.

A fault is an overlay, not a state. A machine can be flagged and running at
the same time — that has to be representable, otherwise the auto-clear rule
above can never fire.

## 8. Milestones

| # | Milestone | Done when | Date |
|---|---|---|---|
| 0 | Laundry room surveyed | Outlets, WiFi, vendor recorded | |
| 1 | RA approval | | |
| 2 | Parts arrived | | |
| 3 | LED blinks | Toolchain works | |
| 4 | Sensor prints over serial | Numbers move when shaken | |
| 5 | Logging to CSV | Timestamps evenly spaced | |
| 6 | First real cycle recorded | | |
| 7 | FFT plotted, states separable | GO / NO-GO | |
| 8 | Classifier working offline | Accuracy measured | |
| 9 | Classifier running on ESP32 | | |
| 10 | Reporting over WiFi | | |
| 11 | Page shows live status | | |
| 12 | Two machines deployed a week | | |
| 13 | Someone else uses it | The finish line | |

Milestone 7 is the decision point. If states don't separate, fall back to a
two-state RMS threshold rather than pushing harder.

## 9. Open questions

1. Which failure mode is worse (section 2.4)
2. Outlets and WiFi in the laundry room
3. What the existing vendor app is and why people don't use it
4. Does mounting position on the machine change the signal
