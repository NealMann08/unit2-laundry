// Which data source the app talks to.
//
// No VITE_API_URL set means the simulator, so `npm run dev` works with no
// server running at all. Point it at a real server in web/.env.local:
//
//   VITE_API_URL=http://192.168.1.50:8000
//
// Both modules export the same three functions and the same snapshot shape,
// so nothing downstream of here knows or cares which one is live.

import * as simulator from "./sensors";
import * as api from "./api";

const source = import.meta.env.VITE_API_URL ? api : simulator;

export const { subscribe, snapshot, reportFault } = source;

export const usingSimulator = source === simulator;
