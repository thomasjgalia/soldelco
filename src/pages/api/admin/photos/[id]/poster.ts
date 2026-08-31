import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

// Used only by the one-time /admin/backfill-posters tool -- captures a
// poster frame in the browser from an already-uploaded video and attaches
// it here, for videos that predate the poster_key column.
export const POST: APIRoute = async ({ request, params, locals }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const id = Number(params.id);
	const photo = await env.DB.prepare(
		`SELECT photos.id, albums.slug FROM photos JOIN albums ON albums.id = photos.album_id WHERE photos.id = ? AND photos.kind = 'video'`,
	)
		.bind(id)
		.first<{ id: number; slug: string }>();
	if (!photo) return new Response('Not found', { status: 404 });

	const form = await request.formData();
	const file = form.get('poster');
	if (!(file instanceof File) || file.size === 0) return new Response('Missing poster', { status: 400 });

	const key = `albums/${photo.slug}/${crypto.randomUUID()}.jpg`;
	await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: 'image/jpeg' } });
	await env.DB.prepare('UPDATE photos SET poster_key = ? WHERE id = ?').bind(key, id).run();

	return new Response('OK');
};
