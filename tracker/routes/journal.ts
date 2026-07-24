import { store, save } from "../db/store.ts";
import { jsonResponse, errorResponse } from "../utils/http.ts";

export function listJournalEntries(): Response {
	const entries = Object.values(store.journal).sort((a, b) => b.date.localeCompare(a.date));
	return jsonResponse(entries);
}

export function getJournalEntry(date: string): Response {
	return jsonResponse(store.journal[date] ?? null);
}

export async function upsertJournalEntry(req: Request): Promise<Response> {
	const body = await req.json().catch(() => null);
	if (!body || typeof body.date !== "string") {
		return errorResponse("date is required (YYYY-MM-DD)", 400);
	}

	const now = new Date().toISOString();
	const existing = store.journal[body.date];

	store.journal[body.date] = {
		date: body.date,
		mood: body.mood ?? null,
		energy: body.energy ?? null,
		notes: body.notes ?? null,
		created_at: existing?.created_at ?? now,
		updated_at: now,
	};

	await save();
	return jsonResponse(store.journal[body.date]);
}

export async function deleteJournalEntry(date: string): Promise<Response> {
	delete store.journal[date];
	await save();
	return jsonResponse({ ok: true });
}
