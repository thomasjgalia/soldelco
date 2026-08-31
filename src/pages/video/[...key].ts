import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// Serves R2-stored video with real Range-request support. /img/[...key].ts
// streams the whole object in one response, which a <video> tag needs for
// initial playback but not for seeking/scrubbing -- the browser silently
// refuses to seek unless every response carries Accept-Ranges: bytes, and a
// scrub bar drag issues a real 206-expecting Range request that a full-body
// 200 response can't satisfy.
export const GET: APIRoute = async ({ params, request }) => {
	const key = params.key;
	if (!key) return new Response('Not found', { status: 404 });

	const head = await env.PHOTOS.head(key);
	if (!head) return new Response('Not found', { status: 404 });
	const size = head.size;
	const contentType = head.httpMetadata?.contentType ?? 'application/octet-stream';

	const rangeHeader = request.headers.get('range');
	if (!rangeHeader) {
		const object = await env.PHOTOS.get(key);
		if (!object) return new Response('Not found', { status: 404 });
		return new Response(object.body, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Content-Length': String(size),
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		});
	}

	// "bytes=start-end" | "bytes=start-" | "bytes=-suffixLength"
	const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
	if (!match || (match[1] === '' && match[2] === '')) {
		return new Response('Invalid Range', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
	}

	let start: number;
	let end: number;
	if (match[1] === '') {
		const suffixLength = Number(match[2]);
		start = Math.max(0, size - suffixLength);
		end = size - 1;
	} else {
		start = Number(match[1]);
		end = match[2] === '' ? size - 1 : Number(match[2]);
	}

	if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
		return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
	}
	end = Math.min(end, size - 1);

	const object = await env.PHOTOS.get(key, { range: { offset: start, length: end - start + 1 } });
	if (!object) return new Response('Not found', { status: 404 });

	return new Response(object.body, {
		status: 206,
		headers: {
			'Content-Type': contentType,
			'Content-Range': `bytes ${start}-${end}/${size}`,
			'Content-Length': String(end - start + 1),
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
};
