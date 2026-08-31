import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const photoId = Number(params.id);
	const photo = await env.DB.prepare('SELECT album_id, r2_key, poster_key FROM photos WHERE id = ?')
		.bind(photoId)
		.first<{ album_id: number; r2_key: string; poster_key: string | null }>();

	if (photo) {
		await env.PHOTOS.delete(photo.r2_key);
		if (photo.poster_key) await env.PHOTOS.delete(photo.poster_key);
		await env.DB.prepare('DELETE FROM photo_tags WHERE photo_id = ?').bind(photoId).run();
		await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(photoId).run();
	}

	return redirect(photo ? `/admin/albums/${photo.album_id}` : '/admin/albums');
};
