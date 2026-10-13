import {
	deleteJournalEntryByDate,
	getJournalEntryByDate,
	listJournalEntriesAll,
	putJournalEntry,
} from "../db/store.ts";
import type { JournalEntry } from "../db/store.ts";
import { jsonResponse, errorResponse } from "../utils/http.ts";

export async function listJournalEntries(): Promise<Response> {
	const entries = (await listJournalEntriesAll()).sort((a, b) => b.date.localeCompare(a.date));
	return jsonResponse(entries);
}

export async function getJournalEntry(date: string): Promise<Response> {
	return jsonResponse(await getJournalEntryByDate(date));
}

export async function upsertJournalEntry(req: Request): Promise<Response> {
	const body = await req.json().catch(() => null);
	if (!body || typeof body.date !== "string") {
		return errorResponse("date is required (YYYY-MM-DD)", 400);
	}

	const now = new Date().toISOString();
	const existing = await getJournalEntryByDate(body.date);

	const entry: JournalEntry = {
		date: body.date,
		mood: body.mood ?? null,
		energy: body.energy ?? null,
		notes: body.notes ?? null,
		created_at: existing?.created_at ?? now,
		updated_at: now,
	};

	await putJournalEntry(entry);
	return jsonResponse(entry);
}

export async function deleteJournalEntry(date: string): Promise<Response> {
	await deleteJournalEntryByDate(date);
	return jsonResponse({ ok: true });
}
