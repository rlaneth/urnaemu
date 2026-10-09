// Runs in front of the static assets (run_worker_first in wrangler.jsonc) only to send plain
// http:// requests to https://; everything else is served from the build as-is.
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.protocol === 'http:') {
			url.protocol = 'https:';
			return Response.redirect(url.toString(), 301);
		}
		return env.ASSETS.fetch(request);
	}
};
