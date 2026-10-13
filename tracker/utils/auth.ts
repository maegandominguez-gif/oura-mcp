// Password gate for when the tracker runs at a public URL. Uses HTTP Basic
// auth: the browser asks once and remembers it, so the frontend needs no
// login screen. With APP_PASSWORD unset (local dev) everything is open.

function constantTimeEqual(a: string, b: string): boolean {
	const x = new TextEncoder().encode(a);
	const y = new TextEncoder().encode(b);
	if (x.length !== y.length) return false;
	let diff = 0;
	for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
	return diff === 0;
}

/** Returns a 401 response when the request lacks the right password, or null to let it through. */
export function checkPassword(req: Request): Response | null {
	const password = Deno.env.get("APP_PASSWORD");
	if (!password) return null;

	const header = req.headers.get("authorization") ?? "";
	if (header.startsWith("Basic ")) {
		try {
			// any username is accepted; only the password matters
			const decoded = atob(header.slice(6));
			const supplied = decoded.slice(decoded.indexOf(":") + 1);
			if (constantTimeEqual(supplied, password)) return null;
		} catch {
			// malformed header, fall through to 401
		}
	}

	return new Response("Password required", {
		status: 401,
		headers: { "www-authenticate": 'Basic realm="Fitness Tracker", charset="UTF-8"' },
	});
}
