import { getDashboard } from "./routes/dashboard.ts";
import {
	deleteJournalEntry,
	getJournalEntry,
	listJournalEntries,
	upsertJournalEntry,
} from "./routes/journal.ts";
import {
	createMacro,
	deleteMacro,
	listMacros,
	macroSummary,
} from "./routes/macros.ts";
import {
	createWorkout,
	deleteWorkout,
	exerciseHistory,
	getWorkout,
	listExerciseNames,
	listWorkouts,
	updateWorkout,
} from "./routes/workouts.ts";
import { errorResponse } from "./utils/http.ts";
import { serveStatic } from "./utils/static.ts";

async function handler(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const { pathname } = url;
	const { method } = req;

	try {
		// dashboard
		if (pathname === "/api/dashboard" && method === "GET") {
			return await getDashboard(url);
		}

		// journal
		if (pathname === "/api/journal" && method === "GET") {
			return listJournalEntries();
		}
		if (pathname === "/api/journal" && method === "PUT") {
			return await upsertJournalEntry(req);
		}
		const journalMatch = pathname.match(/^\/api\/journal\/([^/]+)$/);
		if (journalMatch && method === "GET") {
			return getJournalEntry(decodeURIComponent(journalMatch[1]));
		}
		if (journalMatch && method === "DELETE") {
			return await deleteJournalEntry(decodeURIComponent(journalMatch[1]));
		}

		// workouts
		if (pathname === "/api/workouts" && method === "GET") {
			return listWorkouts(url);
		}
		if (pathname === "/api/workouts" && method === "POST") {
			return await createWorkout(req);
		}
		const workoutMatch = pathname.match(/^\/api\/workouts\/(\d+)$/);
		if (workoutMatch && method === "GET") {
			return getWorkout(Number(workoutMatch[1]));
		}
		if (workoutMatch && method === "PUT") {
			return await updateWorkout(Number(workoutMatch[1]), req);
		}
		if (workoutMatch && method === "DELETE") {
			return await deleteWorkout(Number(workoutMatch[1]));
		}

		// exercises
		if (pathname === "/api/exercises" && method === "GET") {
			return listExerciseNames();
		}
		const exerciseMatch = pathname.match(/^\/api\/exercises\/([^/]+)\/history$/);
		if (exerciseMatch && method === "GET") {
			return exerciseHistory(decodeURIComponent(exerciseMatch[1]));
		}

		// macros
		if (pathname === "/api/macros" && method === "GET") {
			return listMacros(url);
		}
		if (pathname === "/api/macros" && method === "POST") {
			return await createMacro(req);
		}
		if (pathname === "/api/macros/summary" && method === "GET") {
			return macroSummary(url);
		}
		const macroMatch = pathname.match(/^\/api\/macros\/(\d+)$/);
		if (macroMatch && method === "DELETE") {
			return await deleteMacro(Number(macroMatch[1]));
		}

		if (pathname.startsWith("/api/")) {
			return errorResponse("not found", 404);
		}

		// static frontend
		if (method === "GET") {
			return await serveStatic(pathname);
		}

		return errorResponse("not found", 404);
	} catch (err) {
		console.error(err);
		return errorResponse(err instanceof Error ? err.message : "internal error", 500);
	}
}

if (import.meta.main) {
	const port = parseInt(Deno.env.get("PORT") || "3100");
	console.log(`Fitness tracker running at http://localhost:${port}`);
	Deno.serve({ port }, handler);
}
