import { store } from "../db/store.ts";
import { getOuraClient } from "../oura.ts";
import { jsonResponse } from "../utils/http.ts";

function todayISO(): string {
	return new Date().toISOString().split("T")[0];
}

export async function getDashboard(url: URL): Promise<Response> {
	const date = url.searchParams.get("date") || todayISO();

	const journal = store.journal[date] ?? null;
	const workouts = store.workouts
		.filter((w) => w.date === date)
		.sort((a, b) => a.id - b.id);
	const macros = store.macros
		.filter((m) => m.date === date)
		.sort((a, b) => a.id - b.id);

	const macroTotals = macros.reduce(
		(totals, m) => ({
			calories: totals.calories + (m.calories ?? 0),
			protein: totals.protein + (m.protein ?? 0),
			carbs: totals.carbs + (m.carbs ?? 0),
			fat: totals.fat + (m.fat ?? 0),
		}),
		{ calories: 0, protein: 0, carbs: 0, fat: 0 },
	);

	const client = getOuraClient();
	let oura: Record<string, unknown> = { connected: false };

	if (client) {
		const dayDate = new Date(`${date}T00:00:00.000Z`);
		try {
			const [readiness, sleep, activity, ouraWorkouts] = await Promise.all([
				client.getDailyReadiness(dayDate, dayDate),
				client.getDailySleep(dayDate, dayDate),
				client.getDailyActivity(dayDate, dayDate),
				client.getWorkouts(dayDate, dayDate),
			]);

			oura = {
				connected: true,
				readiness: readiness.data[0] ?? null,
				sleep: sleep.data[0] ?? null,
				activity: activity.data[0] ?? null,
				workouts: ouraWorkouts.data ?? [],
			};
		} catch (err) {
			oura = {
				connected: true,
				error: err instanceof Error ? err.message : "failed to fetch Oura data",
			};
		}
	}

	return jsonResponse({
		date,
		journal,
		workouts,
		macros,
		macroTotals,
		oura,
	});
}
