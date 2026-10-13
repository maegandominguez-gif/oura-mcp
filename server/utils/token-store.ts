import { OuraTokenResponse, refreshAccessToken } from './auth.ts';

type StoredToken = OuraTokenResponse & {
	expiresAt: number;
};

// In-memory stores — cleared on restart
const sessions = new Map<string, StoredToken>();
const pendingStates = new Map<string, boolean>();

export const tokenStore = {
	addPendingState(state: string) {
		pendingStates.set(state, true);
		// Clean up after 10 minutes
		setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);
	},

	consumePendingState(state: string): boolean {
		if (!pendingStates.has(state)) return false;
		pendingStates.delete(state);
		return true;
	},

	store(sessionToken: string, tokenData: OuraTokenResponse) {
		sessions.set(sessionToken, {
			...tokenData,
			expiresAt: Date.now() + tokenData.expires_in * 1000,
		});
	},

	async getAccessToken(sessionToken: string): Promise<string | null> {
		const stored = sessions.get(sessionToken);
		if (!stored) return null;

		// Refresh if expiring within 60 seconds
		if (Date.now() >= stored.expiresAt - 60_000) {
			try {
				const refreshed = await refreshAccessToken(stored.refresh_token);
				this.store(sessionToken, refreshed);
				return refreshed.access_token;
			} catch {
				sessions.delete(sessionToken);
				return null;
			}
		}

		return stored.access_token;
	},

	delete(sessionToken: string) {
		sessions.delete(sessionToken);
	},
};
