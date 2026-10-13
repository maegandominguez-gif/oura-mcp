const OURA_AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';

export type OuraTokenResponse = {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
};

function getOAuthConfig() {
	const clientId = Deno.env.get('CLIENT_ID');
	const clientSecret = Deno.env.get('CLIENT_SECRET');
	const port = Deno.env.get('PORT') || '3000';
	const redirectUrl = Deno.env.get('REDIRECT_URL') || `http://localhost:${port}/auth/callback`;

	if (!clientId || !clientSecret) {
		throw new Error('Missing CLIENT_ID or CLIENT_SECRET; check environment variables');
	}

	return { clientId, clientSecret, redirectUrl };
}

export const generateAuthURL = (state: string): string => {
	const { clientId, redirectUrl } = getOAuthConfig();

	const params = new URLSearchParams({
		client_id: clientId,
		state,
		redirect_uri: redirectUrl,
		response_type: 'code',
		scope: 'personal daily heartrate workout tag session spo2',
	});

	return `${OURA_AUTHORIZE_URL}?${params.toString()}`;
};

export const exchangeCodeForToken = async (code: string): Promise<OuraTokenResponse> => {
	const { clientId, clientSecret, redirectUrl } = getOAuthConfig();

	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectUrl,
		client_id: clientId,
		client_secret: clientSecret,
	});

	const response = await fetch(OURA_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Token exchange failed (${response.status}): ${text}`);
	}

	return response.json();
};

export const refreshAccessToken = async (refreshToken: string): Promise<OuraTokenResponse> => {
	const { clientId, clientSecret } = getOAuthConfig();

	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
		client_id: clientId,
		client_secret: clientSecret,
	});

	const response = await fetch(OURA_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Token refresh failed (${response.status}): ${text}`);
	}

	return response.json();
};
