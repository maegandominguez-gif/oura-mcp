import {
	deleteWorkoutEntry,
	getWorkoutEntry,
	insertWorkoutEntry,
	listWorkoutEntries,
	putWorkoutEntry,
} from "../db/store.ts";
import type { ExerciseEntry, WorkoutEntry } from "../db/store.ts";
import { getReadinessScore } from "../oura.ts";
import { jsonResponse, errorResponse } from "../utils/http.ts";

type SetInput = { reps?: number; weight?: number; unit?: string; rpe?: number };
type ExerciseInput = { name: string; sets?: SetInput[] };
type WorkoutInput = { date: string; name: string; notes?: string; readiness?: number | null; exercises?: ExerciseInput[] };

function normalizeExercises(exercises: ExerciseInput[] | undefined): ExerciseEntry[] {
	return (exercises ?? []).map((exercise) => ({
		name: exercise.name,
		sets: (exercise.sets ?? []).map((set) => ({
			reps: set.reps ?? null,
			weight: set.weight ?? null,
			unit: set.unit ?? "lb",
			rpe: set.rpe ?? null,
		})),
	}));
}

/** Matches an exercise across days: "S2C · DB Hammer Curl" and "db hammer curl" are the same lift. */
function exerciseKey(name: string): string {
	return name.replace(/^[A-Z]\d[A-Z]?\s*·\s*/, "").trim().toLowerCase();
}

function newestFirst(a: WorkoutEntry, b: WorkoutEntry): number {
	return b.date.localeCompare(a.date) || b.id - a.id;
}

export async function listWorkouts(url: URL): Promise<Response> {
	const from = url.searchParams.get("from");
	const to = url.searchParams.get("to");

	let workouts = await listWorkoutEntries();
	if (from && to) {
		workouts = workouts.filter((w) => w.date >= from && w.date <= to);
	}

	return jsonResponse(workouts.sort(newestFirst));
}

export async function getWorkout(id: number): Promise<Response> {
	const workout = await getWorkoutEntry(id);
	if (!workout) return errorResponse("workout not found", 404);
	return jsonResponse(workout);
}

export async function createWorkout(req: Request): Promise<Response> {
	const body = await req.json().catch(() => null) as WorkoutInput | null;
	if (!body || typeof body.date !== "string" || typeof body.name !== "string") {
		return errorResponse("date and name are required", 400);
	}

	const workout = await insertWorkoutEntry({
		date: body.date,
		name: body.name,
		notes: body.notes ?? null,
		// look the score up when the client didn't send one, so manual logs get it too
		readiness: body.readiness ?? await getReadinessScore(body.date),
		exercises: normalizeExercises(body.exercises),
	});

	return jsonResponse(workout, 201);
}

export async function updateWorkout(id: number, req: Request): Promise<Response> {
	const workout = await getWorkoutEntry(id);
	if (!workout) return errorResponse("workout not found", 404);

	const body = await req.json().catch(() => null) as WorkoutInput | null;
	if (!body || typeof body.date !== "string" || typeof body.name !== "string") {
		return errorResponse("date and name are required", 400);
	}

	workout.date = body.date;
	workout.name = body.name;
	workout.notes = body.notes ?? null;
	workout.readiness = body.readiness ?? workout.readiness ?? null;
	workout.exercises = normalizeExercises(body.exercises);

	await putWorkoutEntry(workout);
	return jsonResponse(workout);
}

export async function deleteWorkout(id: number): Promise<Response> {
	if (!await getWorkoutEntry(id)) return errorResponse("workout not found", 404);

	await deleteWorkoutEntry(id);
	return jsonResponse({ ok: true });
}

export async function exerciseHistory(name: string): Promise<Response> {
	const rows: { date: string; workout_id: number; reps: number | null; weight: number | null; unit: string; rpe: number | null }[] = [];

	for (const workout of await listWorkoutEntries()) {
		for (const exercise of workout.exercises) {
			if (exerciseKey(exercise.name) !== exerciseKey(name)) continue;
			for (const set of exercise.sets) {
				rows.push({
					date: workout.date,
					workout_id: workout.id,
					reps: set.reps,
					weight: set.weight,
					unit: set.unit,
					rpe: set.rpe,
				});
			}
		}
	}

	rows.sort((a, b) => a.date.localeCompare(b.date));
	return jsonResponse(rows);
}

export async function listExerciseNames(): Promise<Response> {
	const names = new Set<string>();
	for (const workout of await listWorkoutEntries()) {
		for (const exercise of workout.exercises) {
			names.add(exercise.name);
		}
	}
	return jsonResponse([...names].sort((a, b) => a.localeCompare(b)));
}

type ProgressionTarget = {
	last: { date: string; weight: number; unit: string; reps: number | null; maxRpe: number | null } | null;
	target: number | null;
	unit: string;
	reason: string;
};

// Readiness gating from the program: 85+ allows added load, below that hold.
const GREEN_READINESS = 85;

// Fixed-weight implements in the garage, in lb. Barbells are plate-loaded and
// go up 5 lb at a time; these can only move to the next size that exists.
const FIXED_WEIGHTS: { kind: string; pattern: RegExp; sizes: number[] }[] = [
	{ kind: "sandbag", pattern: /\bsandbag\b/i, sizes: [25] },
	{ kind: "kettlebell", pattern: /\b(kb|kettlebell)\b/i, sizes: [25, 35, 53] },
	{ kind: "dumbbell", pattern: /\b(db|dumbbell)s?\b/i, sizes: [8, 10, 12, 15, 20] },
];

/** The next load up for an exercise, or null when already on the heaviest implement. */
function nextLoad(name: string, weight: number, unit: string): { weight: number | null; kind: string | null } {
	const implement = unit === "lb" ? FIXED_WEIGHTS.find((f) => f.pattern.test(name)) : undefined;
	if (!implement) return { weight: weight + (unit === "kg" ? 2.5 : 5), kind: null };
	return { weight: implement.sizes.find((size) => size > weight) ?? null, kind: implement.kind };
}

/**
 * GET /api/progression?date=YYYY-MM-DD&name=...&name=...
 * For each exercise, the last session before `date` and that day's target weight:
 * the next load up (+5 lb on a barbell, the next kettlebell/dumbbell size) when
 * every weighted set was logged at RPE 7 or below, otherwise repeat the weight.
 * No added load when readiness is under 85.
 */
export async function progression(url: URL): Promise<Response> {
	const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
	const names = url.searchParams.getAll("name");

	const [workouts, readiness] = await Promise.all([
		listWorkoutEntries(),
		getReadinessScore(date),
	]);
	const previous = workouts.filter((w) => w.date < date).sort(newestFirst);

	const targets: Record<string, ProgressionTarget> = {};

	for (const name of names) {
		const key = exerciseKey(name);
		let lastSets: ExerciseEntry["sets"] = [];
		let lastDate = "";

		for (const workout of previous) {
			const match = workout.exercises.find((e) => exerciseKey(e.name) === key && e.sets.some((s) => s.weight != null));
			if (match) {
				lastSets = match.sets.filter((s) => s.weight != null);
				lastDate = workout.date;
				break;
			}
		}

		if (!lastSets.length) {
			targets[name] = { last: null, target: null, unit: "lb", reason: "No weighted sets logged yet" };
			continue;
		}

		const top = lastSets.reduce((best, s) => (s.weight! > best.weight! ? s : best));
		const rpes = lastSets.map((s) => s.rpe);
		const allRpeLogged = rpes.every((r) => r != null);
		const maxRpe = allRpeLogged ? Math.max(...(rpes as number[])) : null;
		const next = nextLoad(name, top.weight!, top.unit);

		let target = top.weight!;
		let reason: string;
		if (!allRpeLogged) {
			reason = "RPE not logged on every set, so repeat";
		} else if (maxRpe! > 7) {
			reason = `Top RPE ${maxRpe}, so repeat`;
		} else if (readiness != null && readiness < GREEN_READINESS) {
			reason = `RPE ≤7, but readiness ${readiness} means no added load`;
		} else if (next.weight == null) {
			reason = `RPE ≤7, already on the heaviest ${next.kind}, so add reps`;
		} else {
			target = next.weight;
			reason = "RPE ≤7 on all sets";
		}

		targets[name] = {
			last: { date: lastDate, weight: top.weight!, unit: top.unit, reps: top.reps, maxRpe },
			target,
			unit: top.unit,
			reason,
		};
	}

	return jsonResponse({ date, readiness, targets });
}
