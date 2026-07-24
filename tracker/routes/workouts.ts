import { save, store } from "../db/store.ts";
import type { ExerciseEntry, WorkoutEntry } from "../db/store.ts";
import { jsonResponse, errorResponse } from "../utils/http.ts";

type SetInput = { reps?: number; weight?: number; unit?: string; rpe?: number };
type ExerciseInput = { name: string; sets?: SetInput[] };
type WorkoutInput = { date: string; name: string; notes?: string; exercises?: ExerciseInput[] };

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

export function listWorkouts(url: URL): Response {
	const from = url.searchParams.get("from");
	const to = url.searchParams.get("to");

	let workouts = store.workouts;
	if (from && to) {
		workouts = workouts.filter((w) => w.date >= from && w.date <= to);
	}

	const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
	return jsonResponse(sorted);
}

export function getWorkout(id: number): Response {
	const workout = store.workouts.find((w) => w.id === id);
	if (!workout) return errorResponse("workout not found", 404);
	return jsonResponse(workout);
}

export async function createWorkout(req: Request): Promise<Response> {
	const body = await req.json().catch(() => null) as WorkoutInput | null;
	if (!body || typeof body.date !== "string" || typeof body.name !== "string") {
		return errorResponse("date and name are required", 400);
	}

	const workout: WorkoutEntry = {
		id: store.nextWorkoutId++,
		date: body.date,
		name: body.name,
		notes: body.notes ?? null,
		created_at: new Date().toISOString(),
		exercises: normalizeExercises(body.exercises),
	};

	store.workouts.push(workout);
	await save();
	return jsonResponse(workout, 201);
}

export async function updateWorkout(id: number, req: Request): Promise<Response> {
	const workout = store.workouts.find((w) => w.id === id);
	if (!workout) return errorResponse("workout not found", 404);

	const body = await req.json().catch(() => null) as WorkoutInput | null;
	if (!body || typeof body.date !== "string" || typeof body.name !== "string") {
		return errorResponse("date and name are required", 400);
	}

	workout.date = body.date;
	workout.name = body.name;
	workout.notes = body.notes ?? null;
	workout.exercises = normalizeExercises(body.exercises);

	await save();
	return jsonResponse(workout);
}

export async function deleteWorkout(id: number): Promise<Response> {
	const index = store.workouts.findIndex((w) => w.id === id);
	if (index === -1) return errorResponse("workout not found", 404);

	store.workouts.splice(index, 1);
	await save();
	return jsonResponse({ ok: true });
}

export function exerciseHistory(name: string): Response {
	const rows: { date: string; workout_id: number; reps: number | null; weight: number | null; unit: string; rpe: number | null }[] = [];

	for (const workout of store.workouts) {
		for (const exercise of workout.exercises) {
			if (exercise.name.toLowerCase() !== name.toLowerCase()) continue;
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

export function listExerciseNames(): Response {
	const names = new Set<string>();
	for (const workout of store.workouts) {
		for (const exercise of workout.exercises) {
			names.add(exercise.name);
		}
	}
	return jsonResponse([...names].sort((a, b) => a.localeCompare(b)));
}
