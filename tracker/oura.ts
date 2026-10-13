import { OuraApi } from "../server/client/client.ts";
import { exchangeCodeForToken, generateAuthURL, refreshAccessToken } from "../server/utils/auth.ts";
import type { OuraTokenResponse } from "../server/utils/auth.ts";
import { kv } from "./db/store.ts";
import { errorResponse } from "./utils/http.ts";

// Oura retired personal access tokens, so the tracker signs in with OAuth
// (reusing the MCP server's helpers) and keeps the token in KV so it
// survives restarts and redeploys. OURA_API_KEY still works if set.

type StoredToken = OuraTokenResponse & { expiresAt: number };

const TOKEN_KEY = ["oura", "token"];

async function saveToken(token: OuraTokenResponse): Promise<StoredToken> {
	const stored = { ...token, expiresAt: Date.now() + token.expires_in * 1000 };
	await kv.set(TOKEN_KEY, stored);
	return stored;
}

async function getAccessToken(): Promise<string | null> {
	const entry = await kv.get<StoredToken>(TOKEN_KEY);
	const stored = entry.value;
	if (!stored) return null;

	// refresh if expiring within 60 seconds
	if (Date.now() < stored.expiresAt - 60_000) return stored.access_token;

	try {
		return (await saveToken(await refreshAccessToken(stored.refresh_token))).access_token;
	} catch (err) {
		// another request may have refreshed it first; use that token if so
		const latest = (await kv.get<StoredToken>(TOKEN_KEY)).value;
		if (latest && latest.expiresAt > stored.expiresAt) return latest.access_token;
		console.error("Oura token refresh failed — sign in again at /auth/oura/login", err);
		return null;
	}
}

export async function getOuraClient(): Promise<OuraApi | null> {
	const apiKey = Deno.env.get("OURA_API_KEY") || await getAccessToken();
	return apiKey ? new OuraApi(apiKey) : null;
}

/** Today's (or a given day's) readiness score, or null if Oura isn't connected or has no data. */
export async function getReadinessScore(date: string): Promise<number | null> {
	const client = await getOuraClient();
	if (!client) return null;
	try {
		const day = new Date(`${date}T00:00:00.000Z`);
		const readiness = await client.getDailyReadiness(day, day);
		return readiness.data[0]?.score ?? null;
	} catch {
		return null;
	}
}

export async function startOuraLogin(): Promise<Response> {
	if (!Deno.env.get("REDIRECT_URL")) {
		return errorResponse("REDIRECT_URL is not set — it should be this app's /auth/oura/callback URL", 500);
	}
	const state = crypto.randomUUID();
	await kv.set(["oura", "pending-state", state], true, { expireIn: 10 * 60 * 1000 });
	return Response.redirect(generateAuthURL(state), 302);
}

export async function finishOuraLogin(url: URL): Promise<Response> {
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	if (error) return errorResponse(`Oura sign-in failed: ${error}`, 400);
	if (!code || !state) return errorResponse("missing code or state", 400);

	const stateKey = ["oura", "pending-state", state];
	if (!(await kv.get(stateKey)).value) return errorResponse("sign-in link expired, try again", 400);
	await kv.delete(stateKey);

	await saveToken(await exchangeCodeForToken(code));
	return new Response(null, { status: 302, headers: { location: "/" } });
}
