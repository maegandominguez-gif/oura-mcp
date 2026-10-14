import { getOuraClient } from "../oura.ts";
import { jsonResponse } from "../utils/http.ts";

// Oura auto-detects chores as workouts; they aren't training
const HIDDEN_ACTIVITIES = new Set(["houseWork"]);

/**
 * GET /api/oura/workouts?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Workouts recorded by Oura (classes, walks, runs...), newest first.
 * Defaults to the 8 weeks ending today.
 */
export async function listOuraWorkouts(url: URL): Promise<Response> {
	const client = await getOuraClient();
	if (!client) return jsonResponse({ connected: false, workouts: [] });

	const to = url.searchParams.get("to") || new Date().toISOString().split("T")[0];
	const fromDefault = new Date(`${to}T00:00:00.000Z`);
	fromDefault.setUTCDate(fromDefault.getUTCDate() - 55);
	const from = url.searchParams.get("from") || fromDefault.toISOString().split("T")[0];

	// pad the end by a day for Oura's day boundaries, then trim to the requested range
	const end = new Date(`${to}T00:00:00.000Z`);
	end.setUTCDate(end.getUTCDate() + 1);
	const result = await client.getWorkouts(new Date(`${from}T00:00:00.000Z`), end);

	const workouts = result.data
		.filter((w) => w.day >= from && w.day <= to && !HIDDEN_ACTIVITIES.has(w.activity))
		.sort((a, b) => b.start_datetime.localeCompare(a.start_datetime));

	return jsonResponse({ connected: true, from, to, workouts });
}
