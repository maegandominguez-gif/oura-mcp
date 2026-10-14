import { finishOuraLogin, startOuraLogin } from "./oura.ts";
import { listOuraWorkouts } from "./routes/cardio.ts";
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
	progression,
	updateWorkout,
} from "./routes/workouts.ts";
import { checkPassword } from "./utils/auth.ts";
import { errorResponse } from "./utils/http.ts";
import { serveStatic } from "./utils/static.ts";

export async function handler(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const { pathname } = url;
	const { method } = req;

	const denied = checkPassword(req);
	if (denied) return denied;

	try {
		// oura sign-in
		if (pathname === "/auth/oura/login" && method === "GET") {
			return await startOuraLogin();
		}
		if (pathname === "/auth/oura/callback" && method === "GET") {
			return await finishOuraLogin(url);
		}

		// dashboard
		if (pathname === "/api/dashboard" && method === "GET") {
			return await getDashboard(url);
		}

		// journal
		if (pathname === "/api/journal" && method === "GET") {
			return await listJournalEntries();
		}
		if (pathname === "/api/journal" && method === "PUT") {
			return await upsertJournalEntry(req);
		}
		const journalMatch = pathname.match(/^\/api\/journal\/([^/]+)$/);
		if (journalMatch && method === "GET") {
			return await getJournalEntry(decodeURIComponent(journalMatch[1]));
		}
		if (journalMatch && method === "DELETE") {
			return await deleteJournalEntry(decodeURIComponent(journalMatch[1]));
		}

		// workouts
		if (pathname === "/api/workouts" && method === "GET") {
			return await listWorkouts(url);
		}
		if (pathname === "/api/workouts" && method === "POST") {
			return await createWorkout(req);
		}
		const workoutMatch = pathname.match(/^\/api\/workouts\/(\d+)$/);
		if (workoutMatch && method === "GET") {
			return await getWorkout(Number(workoutMatch[1]));
		}
		if (workoutMatch && method === "PUT") {
			return await updateWorkout(Number(workoutMatch[1]), req);
		}
		if (workoutMatch && method === "DELETE") {
			return await deleteWorkout(Number(workoutMatch[1]));
		}

		// exercises
		if (pathname === "/api/exercises" && method === "GET") {
			return await listExerciseNames();
		}
		const exerciseMatch = pathname.match(/^\/api\/exercises\/([^/]+)\/history$/);
		if (exerciseMatch && method === "GET") {
			return await exerciseHistory(decodeURIComponent(exerciseMatch[1]));
		}

		// progression targets for the Program tab
		if (pathname === "/api/progression" && method === "GET") {
			return await progression(url);
		}

		// cardio recorded by Oura, for the Workouts tab
		if (pathname === "/api/oura/workouts" && method === "GET") {
			return await listOuraWorkouts(url);
		}

		// macros
		if (pathname === "/api/macros" && method === "GET") {
			return await listMacros(url);
		}
		if (pathname === "/api/macros" && method === "POST") {
			return await createMacro(req);
		}
		if (pathname === "/api/macros/summary" && method === "GET") {
			return await macroSummary(url);
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
