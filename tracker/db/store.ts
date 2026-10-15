// Deno KV backed store. KV works the same locally (a sqlite file) and on
// Deno Deploy (a hosted database), so the app runs unchanged in both places.

export type SetEntry = {
	reps: number | null;
	weight: number | null;
	unit: string;
	rpe: number | null;
};

export type ExerciseEntry = {
	name: string;
	sets: SetEntry[];
};

/** Details kept on workouts imported from Oura (cardio, classes...). */
export type OuraWorkoutInfo = {
	id: string;
	activity: string;
	start: string;
	minutes: number;
	calories: number | null;
	distance: number | null; // meters
	intensity: string;
	autodetected: boolean;
};

export type WorkoutEntry = {
	id: number;
	date: string;
	name: string;
	notes: string | null;
	readiness: number | null;
	created_at: string;
	exercises: ExerciseEntry[];
	oura?: OuraWorkoutInfo;
};

export type JournalEntry = {
	date: string;
	mood: number | null;
	energy: number | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

export type MacroEntry = {
	id: number;
	date: string;
	label: string | null;
	calories: number | null;
	protein: number | null;
	carbs: number | null;
	fat: number | null;
	notes: string | null;
	created_at: string;
};

// Locally KV is a file at KV_PATH; on Deno Deploy openKv() takes no path and
// connects to the database attached to the project.
const onDeploy = Boolean(Deno.env.get("DENO_DEPLOYMENT_ID"));
export const kv = await Deno.openKv(onDeploy ? undefined : Deno.env.get("KV_PATH") || "./tracker.kv");

async function listAll<T>(prefix: Deno.KvKey): Promise<T[]> {
	const items: T[] = [];
	for await (const entry of kv.list<T>({ prefix })) {
		items.push(entry.value);
	}
	return items;
}

/** Returns the next id for a collection; the check() makes concurrent calls retry rather than collide. */
async function nextId(collection: string): Promise<number> {
	const key = ["counters", collection];
	while (true) {
		const current = await kv.get<number>(key);
		const next = (current.value ?? 0) + 1;
		const result = await kv.atomic().check(current).set(key, next).commit();
		if (result.ok) return next;
	}
}

// workouts
export async function listWorkoutEntries(): Promise<WorkoutEntry[]> {
	return await listAll<WorkoutEntry>(["workouts"]);
}

export async function getWorkoutEntry(id: number): Promise<WorkoutEntry | null> {
	return (await kv.get<WorkoutEntry>(["workouts", id])).value;
}

export async function insertWorkoutEntry(data: Omit<WorkoutEntry, "id" | "created_at">): Promise<WorkoutEntry> {
	const workout: WorkoutEntry = {
		id: await nextId("workouts"),
		created_at: new Date().toISOString(),
		...data,
	};
	await kv.set(["workouts", workout.id], workout);
	return workout;
}

/**
 * Inserts a workout imported from Oura unless that Oura workout was imported
 * before. The marker outlives the workout, so deleting an import keeps it gone.
 * Returns false when it was already imported.
 */
export async function insertOuraWorkoutEntry(data: Omit<WorkoutEntry, "id" | "created_at"> & { oura: OuraWorkoutInfo }): Promise<boolean> {
	const marker = ["oura", "imported", data.oura.id];
	if ((await kv.get(marker)).value) return false;

	const workout: WorkoutEntry = { id: await nextId("workouts"), created_at: new Date().toISOString(), ...data };
	const result = await kv.atomic()
		.check({ key: marker, versionstamp: null }) // a concurrent sync may have just imported it
		.set(marker, workout.id)
		.set(["workouts", workout.id], workout)
		.commit();
	return result.ok;
}

export async function putWorkoutEntry(workout: WorkoutEntry): Promise<void> {
	await kv.set(["workouts", workout.id], workout);
}

export async function deleteWorkoutEntry(id: number): Promise<void> {
	await kv.delete(["workouts", id]);
}

// macros
export async function listMacroEntries(): Promise<MacroEntry[]> {
	return await listAll<MacroEntry>(["macros"]);
}

export async function getMacroEntry(id: number): Promise<MacroEntry | null> {
	return (await kv.get<MacroEntry>(["macros", id])).value;
}

export async function insertMacroEntry(data: Omit<MacroEntry, "id" | "created_at">): Promise<MacroEntry> {
	const macro: MacroEntry = {
		id: await nextId("macros"),
		created_at: new Date().toISOString(),
		...data,
	};
	await kv.set(["macros", macro.id], macro);
	return macro;
}

export async function deleteMacroEntry(id: number): Promise<void> {
	await kv.delete(["macros", id]);
}

// journal (one entry per date)
export async function listJournalEntriesAll(): Promise<JournalEntry[]> {
	return await listAll<JournalEntry>(["journal"]);
}

export async function getJournalEntryByDate(date: string): Promise<JournalEntry | null> {
	return (await kv.get<JournalEntry>(["journal", date])).value;
}

export async function putJournalEntry(entry: JournalEntry): Promise<void> {
	await kv.set(["journal", entry.date], entry);
}

export async function deleteJournalEntryByDate(date: string): Promise<void> {
	await kv.delete(["journal", date]);
}
