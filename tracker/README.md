# Fitness Tracker

An interactive fitness journal: log workouts (exercises/sets/reps/weight/RPE),
macros, and daily journal notes — alongside your Oura Ring readiness, sleep,
and activity data pulled live from the existing `../server` Oura client.

It's a small Deno HTTP server with a Deno KV datastore and a single-page
vanilla JS/HTML frontend. No build step. It runs the same locally and on
Deno Deploy.

## Local setup

```bash
cd tracker
cp .env.example .env
# fill in CLIENT_ID / CLIENT_SECRET from your Oura app to connect Oura
deno task dev
```

Open `http://localhost:3100` (or whatever `PORT` you set), then visit
`/auth/oura/login` once to connect Oura. Without Oura, everything still
works — the dashboard skips the Oura card and readiness isn't recorded.

Data is stored in a local KV file (`KV_PATH`, defaults to `tracker.kv` inside
`tracker/`, already gitignored).

## Deploying to Deno Deploy

1. At [console.deno.com](https://console.deno.com), create an app from this
   GitHub repo. Build config: no preset, no install or build command,
   runtime **Dynamic**, entrypoint **`tracker/main.ts`**.
2. Add environment variables (mark the secrets as secret):
   - `APP_PASSWORD` — the password the browser asks for. Required: the app is
     otherwise open to anyone with the URL.
   - `CLIENT_ID`, `CLIENT_SECRET` — from your Oura app.
   - `REDIRECT_URL` — `https://<your-app-url>/auth/oura/callback`. Add the same
     URL to the Oura app's redirect URIs.
3. Under **Databases**, provision a Deno KV database and **Assign** it to the app.
4. Open the app, enter the password (any username), then visit
   `/auth/oura/login` once to connect Oura. The token is kept in KV and
   refreshed automatically.

The repo-root `deno.json` enables KV (`"unstable": ["kv"]`) for runs from the
repo root, which is how Deno Deploy starts the app.

## What's in here

- **Dashboard** — a day-by-day view combining your Oura readiness/sleep/steps
  (if connected) with what you've logged: journal mood/notes, workouts, and
  macro totals for that date.
- **Program** — the 3-day garage program. Each exercise shows your last top
  set and today's target: the next load up when every set last time was RPE 7
  or below (+5 lb on a barbell, the next size for kettlebells, dumbbells and
  the sandbag; add reps once on the heaviest), otherwise repeat the weight,
  and no added load when readiness is under 85. Implement sizes are listed in
  `FIXED_WEIGHTS` in `routes/workouts.ts`.
  **Start this workout** loads the day into Workouts with those targets filled in.
- **Journal** — a daily mood + energy + free-text note, with a history list.
- **Workouts** — log a session as a set of exercises, each with sets of
  reps/weight/unit/RPE. The day's Oura readiness is saved with each session.
  Includes a per-exercise trend chart (max weight lifted over time) so you
  can track PRs.
- **Macros** — log meals/entries with calories/protein/carbs/fat, a running
  daily total, and a 30-day calorie trend chart.

## API

All data endpoints live under `/api`:

- `GET /api/dashboard?date=YYYY-MM-DD`
- `GET|PUT /api/journal`, `GET|DELETE /api/journal/:date`
- `GET|POST /api/workouts`, `GET|PUT|DELETE /api/workouts/:id`
- `GET /api/exercises`, `GET /api/exercises/:name/history`
- `GET /api/progression?date=YYYY-MM-DD&name=...&name=...`
- `GET|POST /api/macros`, `DELETE /api/macros/:id`, `GET /api/macros/summary`

Oura sign-in: `GET /auth/oura/login` (redirects back to `/auth/oura/callback`).

Everything else is served as static files from `public/`.
