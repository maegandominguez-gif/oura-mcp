import { save, store } from "../db/store.ts";
import type { MacroEntry } from "../db/store.ts";
import { jsonResponse, errorResponse } from "../utils/http.ts";

type MacroInput = {
	date: string;
	label?: string;
	calories?: number;
	protein?: number;
	carbs?: number;
	fat?: number;
	notes?: string;
};

export function listMacros(url: URL): Response {
	const from = url.searchParams.get("from");
	const to = url.searchParams.get("to");

	let macros = store.macros;
	if (from && to) {
		macros = macros.filter((m) => m.date >= from && m.date <= to);
	}

	const sorted = [...macros].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
	return jsonResponse(sorted);
}

export async function createMacro(req: Request): Promise<Response> {
	const body = await req.json().catch(() => null) as MacroInput | null;
	if (!body || typeof body.date !== "string") {
		return errorResponse("date is required (YYYY-MM-DD)", 400);
	}

	const macro: MacroEntry = {
		id: store.nextMacroId++,
		date: body.date,
		label: body.label ?? null,
		calories: body.calories ?? null,
		protein: body.protein ?? null,
		carbs: body.carbs ?? null,
		fat: body.fat ?? null,
		notes: body.notes ?? null,
		created_at: new Date().toISOString(),
	};

	store.macros.push(macro);
	await save();
	return jsonResponse(macro, 201);
}

export async function deleteMacro(id: number): Promise<Response> {
	const index = store.macros.findIndex((m) => m.id === id);
	if (index === -1) return errorResponse("macro entry not found", 404);

	store.macros.splice(index, 1);
	await save();
	return jsonResponse({ ok: true });
}

export function macroSummary(url: URL): Response {
	const from = url.searchParams.get("from");
	const to = url.searchParams.get("to");

	let macros = store.macros;
	if (from && to) {
		macros = macros.filter((m) => m.date >= from && m.date <= to);
	}

	const byDate = new Map<string, { date: string; calories: number; protein: number; carbs: number; fat: number }>();
	for (const macro of macros) {
		const bucket = byDate.get(macro.date) ?? { date: macro.date, calories: 0, protein: 0, carbs: 0, fat: 0 };
		bucket.calories += macro.calories ?? 0;
		bucket.protein += macro.protein ?? 0;
		bucket.carbs += macro.carbs ?? 0;
		bucket.fat += macro.fat ?? 0;
		byDate.set(macro.date, bucket);
	}

	const summary = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
	return jsonResponse(summary);
}
