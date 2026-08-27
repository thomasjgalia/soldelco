import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// Serves R2-stored photos, resizing images on the fly via the Images binding
// and caching the transformed result at the edge. Videos and anything
// non-image stream straight through from R2.
export const GET: APIRoute = async ({ params, request }) => {
	const key = params.key;
	if (!key) return new Response('Not found', { status: 404 });

	const cache = caches.default;
	const cached = await cache.match(request);
	if (cached) return cached;

	const object = await env.PHOTOS.get(key);
	if (!object) return new Response('Not found', { status: 404 });

	const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';

	if (!object.body || !contentType.startsWith('image/') || contentType === 'image/gif') {
		const response = new Response(object.body, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		});
		return response;
	}

	const width = new URL(request.url).searchParams.get('w');
	let transformer = env.IMAGES.input(object.body);
	if (width) transformer = transformer.transform({ width: Number(width), fit: 'scale-down' });

	const result = await transformer.output({ format: 'image/webp', quality: 82 });
	const response = result.response({
		headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
	});

	await cache.put(request, response.clone());
	return response;
};
