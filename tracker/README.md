# Fitness Tracker

A local, interactive fitness journal: log workouts (exercises/sets/reps/weight),
macros, and daily journal notes — alongside your Oura Ring readiness, sleep,
and activity data pulled live from the existing `../server` Oura client.

It's a small Deno HTTP server with a JSON-file datastore and a single-page
vanilla JS/HTML frontend. No build step, no external services required.

## Setup

```bash
cd tracker
cp .env.example .env
# optionally add your Oura personal access token to .env as OURA_API_KEY
deno task dev
```

Open `http://localhost:3100` (or whatever `PORT` you set).

If `OURA_API_KEY` isn't set, everything still works — the dashboard just
skips the Oura card and you log entries manually.

## What's in here

- **Dashboard** — a day-by-day view combining your Oura readiness/sleep/steps
  (if connected) with what you've logged: journal mood/notes, workouts, and
  macro totals for that date.
- **Journal** — a daily mood + energy + free-text note, with a history list.
- **Workouts** — log a session as a set of exercises, each with sets of
  reps/weight/unit. Includes a per-exercise trend chart (max weight lifted
  over time) so you can track PRs.
- **Macros** — log meals/entries with calories/protein/carbs/fat, a running
  daily total, and a 30-day calorie trend chart.

Data is stored in a single JSON file (`DB_PATH` in `.env`, defaults to
`tracker-data.json` inside `tracker/`, already gitignored).

## API

All data endpoints live under `/api`:

- `GET /api/dashboard?date=YYYY-MM-DD`
- `GET|PUT /api/journal`, `GET|DELETE /api/journal/:date`
- `GET|POST /api/workouts`, `GET|PUT|DELETE /api/workouts/:id`
- `GET /api/exercises`, `GET /api/exercises/:name/history`
- `GET|POST /api/macros`, `DELETE /api/macros/:id`, `GET /api/macros/summary`

Everything else is served as static files from `public/`.
