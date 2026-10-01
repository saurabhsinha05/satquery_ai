# SatQuery AI

**Ask Earth. Get Answers. See the Change.**

An agentic geospatial intelligence platform. You ask a question in plain
language; a LangGraph agent works out what Earth-observation data it needs,
searches the Copernicus Data Space, renders the imagery, runs the analysis on
Copernicus infrastructure, builds the map, and hands back an answer with its
working shown.

The rule this codebase is built around: **a value is either real or absent.**
If a service is unavailable, the product says so. If a statistic could not be
computed, no number is shown. There is no path in the backend that produces a
plausible-looking figure to make the UI look finished.

---

## Architecture

```
Browser (Vite + React + TS + Tailwind)
  │  VITE_MAPBOX_ACCESS_TOKEN  ← map rendering only
  │  VITE_SUPABASE_*           ← auth, publishable key only
  │
  │  fetch /api/agent/run          →  { runId, streamUrl }
  │  EventSource /api/agent/stream/:runId  →  live agent events
  │  <img src="/api/imagery/:id">  →  rasters, proxied so no token reaches the browser
  ▼
Backend (Node 20 + Express + LangGraph)
  ├── LangGraph agent — 12 nodes, typed serialisable state
  ├── OpenAI (LangChain)   — intent, planning, prose.  Never a measurement.
  ├── Copernicus Data Space
  │     ├── OAuth2 client credentials (cached, auto-refreshed)
  │     ├── STAC catalogue + OData catalogue  → dataset discovery
  │     ├── Process API                        → true-colour + change rasters
  │     └── Statistics API                     → every number the product shows
  ├── Mapbox / Nominatim   — geocoding
  ├── Supabase (service role) — persistence, RLS-protected
  └── LangSmith            — full trace of every run
```

### The agent graph

```
START
 → query_understanding      LLM classifies intent, place, period. Never invents coordinates.
 → location_resolution      Geocoder resolves the place. Ambiguity is surfaced, not guessed.
 → analysis_planner         Deterministic intent → method lookup. Picks collection, index, epochs.
 → dataset_discovery        Real catalogue search, scoped to the resolved bbox and window.
 → dataset_validation       Scene selection ranked on cloud, then temporal centring.
 → map_planner              Decides extent, zoom, comparison mode, which overlays to build.
 → eo_processing            Renders imagery + change raster, fetches real statistics.
 → map_generation           Assembles the map contract. Legend built from measured classes only.
 → result_validation        Integrity checks; thin results get labelled thin.
 → evidence_generation      Observation / computation / inference / uncertainty, kept separate.
 → answer_generation        LLM writes prose from the measured facts only.
 → persist                  Supabase: run, steps, datasets, activity, full response.
END
```

Two conditional edges short-circuit to an honest empty result: an unresolvable
location, and a catalogue-only query that needs no processing.

---

## Setup

### Prerequisites

- Node 20+
- A Copernicus Data Space account (free)
- An OpenAI API key
- Optional: Supabase project, Mapbox token, LangSmith account

### 1. Frontend

```bash
npm install
cp .env.example .env.local     # fill in VITE_* values
npm run dev                    # http://localhost:5173
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env           # fill in the backend values
npm run dev                    # http://localhost:8000
```

With `VITE_API_BASE_URL` unset, the Vite dev server proxies `/api` to
`http://localhost:8000` (override with `BACKEND_URL`).

### 3. Database

```bash
# Supabase dashboard → SQL editor → paste and run:
backend/migrations/0001_init.sql
```

The migration creates every table, index, foreign key and RLS policy, plus a
trigger that provisions a `profiles` row on sign-up.

### 4. Verify

```bash
curl http://localhost:8000/api/health
```

The response tells you exactly what is configured and what is missing, and
performs a live Copernicus authentication check.

---

## Environment variables

### Frontend — `.env.local` (shipped to the browser)

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend origin. Blank uses the dev proxy. |
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox GL — map rendering. [Get one](https://account.mapbox.com/access-tokens/) |
| `VITE_SUPABASE_URL` | Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key — designed to be public. |

### Backend — `backend/.env` (never reaches the browser)

| Variable | Purpose | Where to get it |
| --- | --- | --- |
| `PORT` | Listen port (default 8000) | — |
| `FRONTEND_URL` | CORS allow-list, comma-separated. Never `*`. | — |
| `OPENAI_API_KEY` | **LLM / agent reasoning.** Intent, planning, prose. | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `OPENAI_MODEL` | Model id, configured in one place only. | — |
| `COPERNICUS_CLIENT_ID` | **Satellite data authentication.** | [dataspace.copernicus.eu](https://dataspace.copernicus.eu) → Sentinel Hub → OAuth clients |
| `COPERNICUS_CLIENT_SECRET` | Same. Backend only, never logged. | Same |
| `SUPABASE_URL` | Project URL. | Supabase → Settings → API |
| `SUPABASE_SECRET_KEY` | **Privileged database operations.** Service-role key. | Same |
| `LANGSMITH_API_KEY` | **Agent tracing / observability.** | [smith.langchain.com/settings](https://smith.langchain.com/settings) |
| `LANGSMITH_TRACING` | `true` to enable. | — |
| `LANGSMITH_PROJECT` | Trace project name. | — |
| `MAPBOX_TOKEN` | Optional server-side geocoding. Falls back to Nominatim. | Mapbox |
| `AGENT_TIMEOUT_MS` | Hard ceiling on one run (default 120s). | — |

**Never** create `VITE_OPENAI_API_KEY`, `VITE_COPERNICUS_CLIENT_SECRET`,
`VITE_LANGSMITH_API_KEY` or `VITE_SUPABASE_SECRET_KEY`. Anything with a `VITE_`
prefix is compiled into the browser bundle and is readable by anyone.

---

## How the map works

The map is a first-class feature, not a picture of a place.

**Imagery.** Every epoch is rendered by the Sentinel Hub **Process API** for the
*same* bounding box at the *same* output size, using an evalscript that
cloud-masks with the Sentinel-2 scene classification layer and composites the
window. The rendered PNG is stored server-side and served from
`/api/imagery/:id`, so the Copernicus bearer token never reaches the browser.

**Temporal comparison.** Two synchronised Mapbox instances with a draggable
divider. Both are handed the same `center`, `zoom` and `bounds` from the
backend, and each raster is pinned to its exact bbox corners as a Mapbox `image`
source. Comparing two different extents is not something this code can do — the
extents come from one variable.

**Change overlay.** A two-datasource evalscript samples both epochs and
classifies each pixel on Copernicus infrastructure. The returned raster is the
analysis output, not a decoration drawn over it.

**Legend.** Built from the measured class areas. A class with zero pixels does
not appear in the legend, because the legend is derived from the statistics
rather than from the method definition.

**Scene selection.** Not the first catalogue result. Scenes are scored on cloud
cover first, then on how centred the acquisition is in its window, so both
epochs are as comparable as the archive allows. Each selection carries its
reason, visible in the evidence panel.

---

## How the numbers are produced

Every statistic comes from the Sentinel Hub **Statistics API**:

- **Index means** — a FLOAT32 evalscript emits NDVI/NDBI/NDWI plus a `dataMask`;
  the API returns the genuine mean, min, max, standard deviation and sample
  counts over the bbox for that window.
- **Class areas** — a multi-band evalscript emits one 0/1 indicator per change
  class. The mean of each band is the fraction of *valid* pixels in that class,
  which multiplied by the valid analysed area gives a real area in km².
- **Deltas** — arithmetic on two measured means, nothing more.

If the API returns no valid samples, the analysis reports `no_data` and the UI
shows an empty state. If Copernicus is not configured, the analysis reports
`data_available_processing_required`. Neither case produces a number.

---

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/agent/run` | Start a run. Returns `{ runId, streamUrl }` immediately. |
| `GET` | `/api/agent/stream/:runId` | Server-Sent Events. Replays events fired before connect. |
| `GET` | `/api/agent/run/:runId` | Polling fallback. |
| `GET` | `/api/analyses/:runId` | A stored run. |
| `GET` | `/api/imagery/:id` | A rendered raster, from our origin. |
| `GET` | `/api/capabilities` | What this deployment can do, and what is missing. |
| `GET` | `/api/health` | Liveness plus a live Copernicus auth check. |
| `GET` | `/api/datasets` | Collections the backend understands. |
| `GET` | `/api/activity` | Real activity feed from Supabase. |
| `GET` `POST` | `/api/saved` | Saved analyses. |

**SSE events:** `agent.started`, `query.understood`, `location.resolved`,
`map.planned`, `dataset.search.started`, `dataset.search.completed`,
`dataset.selected`, `imagery.selected`, `analysis.started`, `analysis.progress`,
`map.updated`, `analysis.completed`, `evidence.generated`, `workspace.updated`,
`agent.completed`, `agent.error`.

The workspace status line and the chat plan render these messages verbatim.
There are no hardcoded loading strings in the live path.

---

## Adding an analysis

1. Add an evalscript to `backend/src/services/copernicus/evalscripts.ts`.
2. Add a spec file under `backend/src/eo/` (see `ndvi.ts` for the shape).
3. Register it in `backend/src/eo/registry.ts` and map an intent to it.

The runner, the graph, the map builder and the frontend need no changes.

---

## Testing

```bash
cd backend && npm test
```

44 tests, run with **no credentials configured on purpose** — the property most
worth locking down is that an unconfigured backend reports its limits rather
than fabricating a result. Coverage includes query classification for all nine
reference queries, date-range construction and clamping, geo maths, scene
selection ranking, evalscript structure, API validation, CORS/404 behaviour,
the capability report, and secret redaction in logs.

```bash
npm run typecheck      # frontend
cd backend && npm run typecheck
```

---

## LangSmith traces

Set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY`, then open
[smith.langchain.com](https://smith.langchain.com) and select the
`satquery-ai` project. Each run appears as a `satquery-agent` trace with every
node, LLM call and tool call nested underneath, tagged with the run id. The
result panel links straight to it.

Secrets are redacted before anything is logged or traced — see
`backend/src/lib/logger.ts`.

---

## Security

- Backend secrets live only in `backend/.env`, are validated by Zod at boot,
  and are never serialised into a response, a log line or a trace.
- Identity comes from a verified Supabase access token. A `userId` in a request
  body is ignored.
- RLS is enabled on every table; the browser's anon key can only reach the
  signed-in user's own rows.
- CORS uses an explicit origin allow-list from `FRONTEND_URL`.
- Agent runs are rate-limited (8/min), payload-capped (256 kB), and bounded by
  `AGENT_TIMEOUT_MS` with a LangGraph recursion limit.

---

## Deployment

**Backend** — any Node 20 host (Fly, Railway, Render, a container).
`npm run build && npm start`. Set every backend variable; set `FRONTEND_URL` to
your deployed frontend origin.

**Frontend** — any static host (Vercel, Netlify, Cloudflare Pages).
`npm run build`, deploy `dist/`. Set `VITE_API_BASE_URL` to the backend origin.

**Database** — run the migration against your Supabase project.

Rendered rasters are held in memory for an hour. For multiple backend instances,
move `backend/src/services/imageryStore.ts` onto object storage or Redis and
serve signed URLs — the interface is small and deliberately swappable.

---

## Running without a backend

If the frontend cannot reach a backend, the workspace falls back to a local
demo engine and says so in the status line. That path is clearly labelled
everywhere it appears and is never mixed with live data: the moment a backend
answers `/api/capabilities`, the backend response is the only source of truth.

---

## Project layout

```
src/                          Frontend (already built — the backend wires into it)
├── lib/
│   ├── contract.ts           Mirror of the backend response contract
│   ├── api.ts                The single API abstraction
│   ├── config.ts             VITE_ env access, session id
│   ├── supabaseClient.ts     Browser auth
│   └── liveSteps.ts          Backend events → chat plan
├── components/workspace/
│   ├── MapboxView.tsx        Synchronised dual-map comparison, overlays, legend
│   └── LiveResultPanel.tsx   Real datasets, statistics, evidence, timeline, steps
└── state/WorkspaceContext.tsx  Backend probe, SSE streaming, live state

backend/
├── src/
│   ├── types/contract.ts     Source of truth for every shape
│   ├── config/               env (Zod-validated), llm (one place)
│   ├── lib/                  logger (redacting), cache, errors, geo
│   ├── services/
│   │   ├── copernicus/       auth, catalog, process, statistics, evalscripts
│   │   ├── geocode.ts        Mapbox or Nominatim
│   │   ├── supabase.ts       Persistence, service-role only
│   │   └── imageryStore.ts   Server-side raster store
│   ├── eo/                   Analysis specs + runner (extensible)
│   ├── agent/                state, graph, run, events, nodes/
│   └── api/                  routes, auth, rate limiting
├── migrations/0001_init.sql
└── tests/
```
