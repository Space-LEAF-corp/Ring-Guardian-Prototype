# ring-guardian-prototype

A modular, non‑intrusive middleware that runs alongside Ring and your smart home stack to provide anticipatory, family‑centric stewardship. It reframes raw alerts into subtle reminders, consent flows, and safety nudges while learning household rhythms and preserving privacy.

## Overview

**Purpose**  
Provide a parallel guardian layer that listens to events from Ring, locks, appliances, calendars, and GPS, interprets context, and issues dignified prompts and one‑tap actions without modifying vendor services.

**Why it matters**  
Transforms noisy alerts into meaningful, timely nudges that help families stay safe and connected while preserving dignity and minimizing interruptions.

**Design principles**  
- **Non intrusive**: Listens and nudges; does not alter vendor services.  
- **Privacy first**: Local‑first storage and opt‑in integrations.  
- **Consent centric**: One‑tap approvals and clear audit logs.  
- **Ceremonial tone**: Optional framing for warmth and clarity.  
- **Safety rails**: Rate limits, quiet hours, and escalation thresholds.

## Features

- **Departure and Arm Suggestions** — Detects likely departures and prompts to arm the home and check locks.  
- **Lock Awareness** — Notices unlocked doors on departure and offers remote lock actions.  
- **Appliance Safety Layer** — Detects appliances left on at departure and offers timed reminders or remote shutoff.  
- **Family Arrival ETA** — Integrates school dismissal or GPS to estimate child arrival and offers preps like lights or unlock.  
- **Consent Detour Flow** — Detects child detours and mediates a quick parent approval loop with Yes or No responses.  
- **Overdue Arrival Escalation** — Nudges parents when arrival exceeds configured thresholds and offers location or call options.  
- **Quiet Cabin Mode** — Suggests soft chimes and warm lighting for doorbell events during quiet hours.  
- **Lightweight Learning Engine** — Learns departure patterns, missed locks, and appliance habits to reduce false positives and tune nudges.

## Quick Start

**Requirements**  
- **Node** 18 or later for the prototype demo.  
- Optional vendor SDKs when wiring real adapters.

**Run the prototype demo**  
1. Save the single file prototype to `src/ring-guardian-prototype.js`.  
2. Run the demo:

```bash
node src/ring-guardian-prototype.js
