const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

const PUBLIC_DIR = new URL("../public/", import.meta.url);

export async function serveStatic(pathname: string): Promise<Response> {
	let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");

	// prevent path traversal outside of the public directory
	relativePath = relativePath.split("/").filter((segment) => segment !== "..").join("/");

	const fileUrl = new URL(relativePath, PUBLIC_DIR);

	try {
		const data = await Deno.readFile(fileUrl);
		const ext = relativePath.slice(relativePath.lastIndexOf("."));
		return new Response(data as BodyInit, {
			headers: { "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream" },
		});
	} catch {
		return new Response("Not Found", { status: 404 });
	}
}
