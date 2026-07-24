// A tiny JSON-file backed store. This is a single-user local app tracking a
// personal fitness journal, so a whole-file read/write is simpler and more
// dependable than pulling in a native SQLite binding.

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

export type WorkoutEntry = {
	id: number;
	date: string;
	name: string;
	notes: string | null;
	created_at: string;
	exercises: ExerciseEntry[];
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

type Store = {
	journal: Record<string, JournalEntry>;
	workouts: WorkoutEntry[];
	macros: MacroEntry[];
	nextWorkoutId: number;
	nextMacroId: number;
};

const DB_PATH = Deno.env.get("DB_PATH") || "./tracker-data.json";

function defaultStore(): Store {
	return { journal: {}, workouts: [], macros: [], nextWorkoutId: 1, nextMacroId: 1 };
}

function loadStore(): Store {
	try {
		const raw = Deno.readTextFileSync(DB_PATH);
		const parsed = JSON.parse(raw);
		return { ...defaultStore(), ...parsed };
	} catch (err) {
		if (err instanceof Deno.errors.NotFound) {
			return defaultStore();
		}
		throw err;
	}
}

export const store: Store = loadStore();

let writeChain: Promise<void> = Promise.resolve();

/** Persists the current store to disk. Calls are serialized so concurrent
 * mutations never race each other or interleave writes to the file. */
export function save(): Promise<void> {
	writeChain = writeChain.then(() =>
		Deno.writeTextFile(DB_PATH, JSON.stringify(store, null, 2))
	);
	return writeChain;
}
