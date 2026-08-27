import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const albumId = Number(params.id);

	const { results: photos } = await env.DB.prepare('SELECT r2_key FROM photos WHERE album_id = ?')
		.bind(albumId)
		.all<{ r2_key: string }>();

	for (const photo of photos) {
		await env.PHOTOS.delete(photo.r2_key);
	}

	await env.DB.prepare('DELETE FROM photos WHERE album_id = ?').bind(albumId).run();
	await env.DB.prepare('DELETE FROM albums WHERE id = ?').bind(albumId).run();

	return redirect('/admin/albums');
};
