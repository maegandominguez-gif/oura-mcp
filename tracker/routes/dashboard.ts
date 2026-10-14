import { getJournalEntryByDate, listMacroEntries, listWorkoutEntries } from "../db/store.ts";
import { getOuraClient } from "../oura.ts";
import { jsonResponse } from "../utils/http.ts";

function todayISO(): string {
	return new Date().toISOString().split("T")[0];
}

export async function getDashboard(url: URL): Promise<Response> {
	const date = url.searchParams.get("date") || todayISO();

	const [journal, allWorkouts, allMacros, client] = await Promise.all([
		getJournalEntryByDate(date),
		listWorkoutEntries(),
		listMacroEntries(),
		getOuraClient(),
	]);
	const workouts = allWorkouts
		.filter((w) => w.date === date)
		.sort((a, b) => a.id - b.id);
	const macros = allMacros
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

	let oura: Record<string, unknown> = { connected: false };

	if (client) {
		// Oura's day boundaries (4am to 4am) mean a start_date == end_date query can come
		// back empty, notably for daily activity. Ask for the surrounding days and pick
		// the entry whose `day` matches.
		const from = new Date(`${date}T00:00:00.000Z`);
		from.setUTCDate(from.getUTCDate() - 1);
		const to = new Date(`${date}T00:00:00.000Z`);
		to.setUTCDate(to.getUTCDate() + 1);

		const forDay = <T extends { day: string }>(result: PromiseSettledResult<{ data: T[] }>): T | null =>
			result.status === "fulfilled" ? result.value.data.find((d) => d.day === date) ?? null : null;

		// allSettled so one failing endpoint (e.g. a missing scope) doesn't blank the whole card
		const [readiness, sleep, activity, stress, spo2, sleepPeriods, ouraWorkouts] = await Promise.allSettled([
			client.getDailyReadiness(from, to),
			client.getDailySleep(from, to),
			client.getDailyActivity(from, to),
			client.getDailyStress(from, to),
			client.getDailySPO2(from, to),
			client.getSleepPeriods(from, to),
			client.getWorkouts(from, to),
		]);

		// the main overnight sleep for this day, falling back to the longest period
		const periods = sleepPeriods.status === "fulfilled"
			? sleepPeriods.value.data.filter((p) => p.day === date && p.type !== "deleted")
			: [];
		const mainSleep = periods.find((p) => p.type === "long_sleep") ??
			periods.sort((a, b) => (b.total_sleep_duration ?? 0) - (a.total_sleep_duration ?? 0))[0] ??
			null;

		const results = [readiness, sleep, activity, stress, spo2, sleepPeriods, ouraWorkouts];
		const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

		oura = {
			connected: true,
			readiness: forDay(readiness),
			sleep: forDay(sleep),
			activity: forDay(activity),
			stress: forDay(stress),
			spo2: forDay(spo2),
			sleepPeriod: mainSleep,
			workouts: ouraWorkouts.status === "fulfilled" ? ouraWorkouts.value.data.filter((w) => w.day === date) : [],
			...(failed.length === results.length && {
				error: failed[0].reason instanceof Error ? failed[0].reason.message : "failed to fetch Oura data",
			}),
		};
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
