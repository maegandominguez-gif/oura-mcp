import { OuraApi } from "../server/client/client.ts";

let client: OuraApi | null = null;
let warned = false;

export function getOuraClient(): OuraApi | null {
	const apiKey = Deno.env.get("OURA_API_KEY");
	if (!apiKey) {
		if (!warned) {
			console.warn("OURA_API_KEY not set — dashboard will run without Oura data.");
			warned = true;
		}
		return null;
	}
	if (!client) {
		client = new OuraApi(apiKey);
	}
	return client;
}
