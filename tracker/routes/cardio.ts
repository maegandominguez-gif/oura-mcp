import type { OuraApi } from "../../server/client/client.ts";
import type { Workout } from "../../server/client/client.types.ts";
import { insertOuraWorkoutEntry, kv } from "../db/store.ts";
import { getOuraClient } from "../oura.ts";
import { jsonResponse } from "../utils/http.ts";

// Oura auto-detects chores as workouts; they aren't training
const HIDDEN_ACTIVITIES = new Set(["houseWork"]);

function addDays(iso: string, days: number): string {
	const d = new Date(`${iso}T00:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().split("T")[0];
}

/** All Oura workouts between two days, following Oura's pagination. */
async function fetchOuraWorkouts(client: OuraApi, from: string, to: string): Promise<Workout[]> {
	const workouts: Workout[] = [];
	let token: string | null = null;
	do {
		// pad the end by a day for Oura's day boundaries; callers trim by `day`
		const page = await client.getWorkouts(new Date(`${from}T00:00:00.000Z`), new Date(`${addDays(to, 1)}T00:00:00.000Z`), token);
		workouts.push(...page.data);
		token = page.next_token;
	} while (token);
	return workouts.filter((w) => w.day >= from && w.day <= to && !HIDDEN_ACTIVITIES.has(w.activity));
}

/**
 * GET /api/oura/workouts?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Workouts recorded by Oura (classes, walks, runs...), newest first.
 * Defaults to the 8 weeks ending today.
 */
export async function listOuraWorkouts(url: URL): Promise<Response> {
	const client = await getOuraClient();
	if (!client) return jsonResponse({ connected: false, workouts: [] });

	const to = url.searchParams.get("to") || new Date().toISOString().split("T")[0];
	const from = url.searchParams.get("from") || addDays(to, -55);

	const workouts = (await fetchOuraWorkouts(client, from, to))
		.sort((a, b) => b.start_datetime.localeCompare(a.start_datetime));

	return jsonResponse({ connected: true, from, to, workouts });
}

// The first sync imports everything since this date.
const BACKFILL_FROM = "2020-01-01";
// Later syncs re-check this many days before the last sync, to catch workouts
// the ring uploads late.
const RESYNC_OVERLAP_DAYS = 7;
// Page loads trigger a sync; skip it if one ran this recently.
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;

// "strengthTraining" -> "Strength training"
function humanizeActivity(activity: string): string {
	if (activity === "hiit") return "HIIT";
	const words = activity.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
	return words[0].toUpperCase() + words.slice(1);
}

/**
 * POST /api/oura/sync[?force=1]
 * Imports Oura workouts into the workout log. Each Oura workout is imported
 * at most once, so a deleted import is not re-added.
 */
export async function syncOuraWorkouts(url: URL): Promise<Response> {
	const client = await getOuraClient();
	if (!client) return jsonResponse({ connected: false, added: 0 });

	const lastSync = (await kv.get<{ at: number; through: string }>(["oura", "last-sync"])).value;
	if (lastSync && !url.searchParams.has("force") && Date.now() - lastSync.at < MIN_SYNC_INTERVAL_MS) {
		return jsonResponse({ connected: true, added: 0, skipped: true });
	}

	const today = new Date().toISOString().split("T")[0];
	const from = lastSync ? addDays(lastSync.through, -RESYNC_OVERLAP_DAYS) : BACKFILL_FROM;
	const workouts = await fetchOuraWorkouts(client, from, addDays(today, 1));

	// readiness for each workout's day, fetched once for the whole range
	const readinessByDay = new Map<string, number | null>();
	try {
		const readiness = await client.getDailyReadiness(new Date(`${from}T00:00:00.000Z`), new Date(`${addDays(today, 2)}T00:00:00.000Z`));
		for (const r of readiness.data) readinessByDay.set(r.day, r.score);
	} catch {
		// readiness is a nice-to-have on imports
	}

	let added = 0;
	for (const w of workouts) {
		const inserted = await insertOuraWorkoutEntry({
			date: w.day,
			name: w.label || humanizeActivity(w.activity),
			notes: null,
			readiness: readinessByDay.get(w.day) ?? null,
			exercises: [],
			oura: {
				id: w.id,
				activity: w.activity,
				start: w.start_datetime,
				minutes: Math.round((Date.parse(w.end_datetime) - Date.parse(w.start_datetime)) / 60000),
				calories: w.calories,
				distance: w.distance,
				intensity: w.intensity,
				autodetected: w.source === "autodetected",
			},
		});
		if (inserted) added++;
	}

	await kv.set(["oura", "last-sync"], { at: Date.now(), through: today });
	return jsonResponse({ connected: true, added, checked: workouts.length, from });
}
