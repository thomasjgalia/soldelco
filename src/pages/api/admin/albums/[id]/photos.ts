import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';
import { uploadPhotosToAlbum } from '../../../../../lib/photos';
import { sendPushToAllExcept } from '../../../../../lib/push';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const albumId = Number(params.id);
	const album = await env.DB.prepare('SELECT id, slug, title, occurred_at FROM albums WHERE id = ?')
		.bind(albumId)
		.first<{ id: number; slug: string; title: string; occurred_at: string | null }>();
	if (!album) return redirect('/admin/albums');

	const form = await request.formData();
	const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
	await uploadPhotosToAlbum(env, { id: album.id, slug: album.slug, occurredAt: album.occurred_at }, files, identity.memberId);

	if (files.length > 0) {
		await sendPushToAllExcept(env, identity.memberId, {
			title: `${identity.displayName} added photos`,
			body: `New photos in "${album.title}"`,
			url: `/albums/${album.slug}`,
		});
	}

	return redirect(`/admin/albums/${albumId}`);
};
