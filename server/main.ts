import { FastMCP } from "fastmcp";
import { OuraApi } from "./client/client.ts";
import { mcpLogger } from "./utils/logger.ts";
import { wrapToolExecution } from "./utils/tool-wrapper.ts";
import { generateAuthURL, exchangeCodeForToken } from "./utils/auth.ts";
import { tokenStore } from "./utils/token-store.ts";
import * as http from "node:http";

import * as v from 'valibot';

interface SessionData {
	api: OuraApi;
	sessionId: string;
	userEmail: string;
	[key: string]: unknown;
}

const startServer = (): FastMCP => {
	// setup the MCP server
	const server: FastMCP = new FastMCP({
		name: "Oura MCP",
		version: "1.0.0",
		authenticate: async (request: http.IncomingMessage): Promise<SessionData> => {
			const headers = request.headers ?? {}

			const getHeaderString = (header: string | string[] | undefined) =>
				Array.isArray(header) ? header.join(", ") : (header ?? "");

			// @ts-ignore: this is fine
			const authorization = getHeaderString(headers['authorization']);
			if (!authorization) {
				throw new Response(null, { status: 401, statusText: 'Unauthorized' });
			}

			if (!authorization.toLowerCase().startsWith('bearer ')) {
				throw new Response(null, { status: 400, statusText: 'Bad Request: Missing Bearer Token' });
			}

			const bearerToken = authorization.slice(7);

			// Try as a session token first, fall back to using it directly as an Oura access token
			let accessToken = await tokenStore.getAccessToken(bearerToken);
			if (!accessToken) {
				accessToken = bearerToken;
			}

			const api = new OuraApi(accessToken);

			let personalInfo;
			try {
				personalInfo = await api.getPersonalInfo();
			} catch {
				throw new Response(null, { status: 401, statusText: 'Unauthorized' });
			}

			const sessionId = crypto.randomUUID();
			const userEmail = personalInfo.email;

			mcpLogger.logSessionCreated(sessionId, userEmail);

			return { api, sessionId, userEmail };
		},
		health: {
			enabled: true,
			message: 'healthy!',
			path: '/health',
			status: 200,
		},
		ping: {
			enabled: true,
			intervalMs: 10_000,
			logLevel: 'debug'
		}
	})

	server.addTool({
		name: 'daily-activity',
		description: "get the user's daily activity for a set of days. takes two dates in the YYYY-MM-DD format. If no date is provided this just fetches the current days data.",
		parameters: v.object({
			startDate: v.optional(v.string()),
			endDate: v.optional(v.string()),
		}),
		execute: wrapToolExecution('daily-activity', async (args: { startDate?: string; endDate?: string }, context: any) => {
			const session = context.session as SessionData;
			const api = session.api

			if (!args.startDate || !args.endDate) {
				const response = await api.getDailyActivity();
				return JSON.stringify(response);
			} else {
				const response = await api.getDailyActivity(new Date(args.startDate), new Date(args.endDate));
				return JSON.stringify(response);
			}
		})
	})

	server.addTool({
		name: 'daily-readiness',
		description: "get the user's daily readiness for a set of days. takes two dates in the YYYY-MM-DD format. If no date is provided this just fetches the current days data.",
		parameters: v.object({
			startDate: v.optional(v.string()),
			endDate: v.optional(v.string()),
		}),
		execute: wrapToolExecution('daily-readiness', async (args: { startDate?: string; endDate?: string }, context: any) => {
			const session = context.session as SessionData;
			const api = session.api

			if (!args.startDate || !args.endDate) {
				const response = await api.getDailyReadiness();
				return JSON.stringify(response);
			} else {
				const response = await api.getDailyReadiness(new Date(args.startDate), new Date(args.endDate));
				return JSON.stringify(response);
			}
		})
	})

	server.addTool({
		name: 'daily-sleep',
		description: "get the user's daily sleep for a set of days. takes two dates in the YYYY-MM-DD format. If no date is provided this just fetches the current days data.",
		parameters: v.object({
			startDate: v.optional(v.string()),
			endDate: v.optional(v.string()),
		}),
		execute: wrapToolExecution('daily-sleep', async (args: { startDate?: string; endDate?: string }, context: any) => {
			const session = context.session as SessionData;
			const api = session.api

			if (!args.startDate || !args.endDate) {
				const response = await api.getDailySleep();
				return JSON.stringify(response);
			} else {
				const response = await api.getDailySleep(new Date(args.startDate), new Date(args.endDate));
				return JSON.stringify(response);
			}
		})
	})

	server.addTool({
		name: 'heart-rate',
		description: "get the user's heart rate data for a set of days. takes two dates in the YYYY-MM-DD format. If no date is provided this just fetches the current days data.",
		parameters: v.object({
			startDate: v.optional(v.string()),
			endDate: v.optional(v.string()),
		}),
		execute: wrapToolExecution('heart-rate', async (args: { startDate?: string; endDate?: string }, context: any) => {
			const session = context.session as SessionData;
			const api = session.api

			if (!args.startDate || !args.endDate) {
				const response = await api.getHeartRate();
				return JSON.stringify(response);
			} else {
				const response = await api.getHeartRate(new Date(args.startDate), new Date(args.endDate));
				return JSON.stringify(response);
			}
		})
	})

	server.addTool({
		name: 'daily-stress',
		description: "get the user's daily stress data for a set of days. takes two dates in the YYYY-MM-DD format. If no date is provided this just fetches the current days data.",
		parameters: v.object({
			startDate: v.optional(v.string()),
			endDate: v.optional(v.string()),
		}),
		execute: wrapToolExecution('daily-stress', async (args: { startDate?: string; endDate?: string }, context: any) => {
			const session = context.session as SessionData;
			const api = session.api

			if (!args.startDate || !args.endDate) {
				const response = await api.getDailyStress();
				return JSON.stringify(response);
			} else {
				const response = await api.getDailyStress(new Date(args.startDate), new Date(args.endDate));
				return JSON.stringify(response);
			}
		})
	})

	server.addTool({
		name: 'workouts',
		description: "get the user's workout data for a set of days. takes two dates in the YYYY-MM-DD format. If no date is provided this fetches the last 7 days of data.",
		parameters: v.object({
			startDate: v.optional(v.string()),
			endDate: v.optional(v.string()),
		}),
		execute: wrapToolExecution('workouts', async (args: { startDate?: string; endDate?: string }, context: any) => {
			const session = context.session as SessionData;
			const api = session.api

			if (!args.startDate || !args.endDate) {
				const response = await api.getWorkouts();
				return JSON.stringify(response);
			} else {
				const response = await api.getWorkouts(new Date(args.startDate), new Date(args.endDate));
				return JSON.stringify(response);
			}
		})
	})

	server.addTool({
		name: 'daily-spo2',
		description: "get the user's daily blood oxygen (SpO2) data for a set of days. takes two dates in the YYYY-MM-DD format. If no date is provided this just fetches the current days data.",
		parameters: v.object({
			startDate: v.optional(v.string()),
			endDate: v.optional(v.string()),
		}),
		execute: wrapToolExecution('daily-spo2', async (args: { startDate?: string; endDate?: string }, context: any) => {
			const session = context.session as SessionData;
			const api = session.api

			if (!args.startDate || !args.endDate) {
				const response = await api.getDailySPO2();
				return JSON.stringify(response);
			} else {
				const response = await api.getDailySPO2(new Date(args.startDate), new Date(args.endDate));
				return JSON.stringify(response);
			}
		})
	})

	return server;
}


function startOAuthServer() {
	const mcpPort = parseInt(Deno.env.get('PORT') || '3000');
	const authPort = parseInt(Deno.env.get('AUTH_PORT') || '3001');

	Deno.serve({ port: authPort, hostname: '0.0.0.0' }, async (req) => {
		const url = new URL(req.url);

		if (url.pathname === '/auth/login') {
			const state = crypto.randomUUID();
			tokenStore.addPendingState(state);
			return Response.redirect(generateAuthURL(state), 302);
		}

		if (url.pathname === '/auth/callback') {
			const code = url.searchParams.get('code');
			const state = url.searchParams.get('state');
			const error = url.searchParams.get('error');

			if (error) {
				return new Response(`OAuth error: ${error}`, { status: 400 });
			}
			if (!code || !state) {
				return new Response('Missing code or state', { status: 400 });
			}
			if (!tokenStore.consumePendingState(state)) {
				return new Response('Invalid or expired state', { status: 400 });
			}

			try {
				const tokenData = await exchangeCodeForToken(code);
				const sessionToken = crypto.randomUUID();
				tokenStore.store(sessionToken, tokenData);

				const html = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px">
<h2>✅ Connected to Oura!</h2>
<p>Your session token (use as Bearer token for MCP connections):</p>
<pre style="background:#f0f0f0;padding:12px;word-break:break-all;border-radius:6px">${sessionToken}</pre>
<p>Add to Claude Code:</p>
<pre style="background:#f0f0f0;padding:12px;border-radius:6px">claude mcp add oura --transport http http://localhost:${mcpPort}/mcp --header "Authorization: Bearer ${sessionToken}"</pre>
</body></html>`;
				return new Response(html, { headers: { 'Content-Type': 'text/html' } });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return new Response(`Token exchange failed: ${msg}`, { status: 500 });
			}
		}

		return new Response('Not found', { status: 404 });
	});

	console.log(`Auth server running on http://localhost:${authPort}`);
	console.log(`  Login: http://localhost:${authPort}/auth/login`);
}

if (import.meta.main) {
	const server = startServer();

	startOAuthServer();

	await server.start({
		transportType: 'httpStream',
		httpStream: {
			host: Deno.env.get('HOST') || '0.0.0.0',
			port: parseInt(Deno.env.get('PORT') || '3000'),
		}
	})
}
