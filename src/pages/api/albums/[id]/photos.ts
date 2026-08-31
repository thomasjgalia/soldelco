import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadPhotosToAlbum } from '../../../../lib/photos';
import { sendPushToAllExcept } from '../../../../lib/push';
import { logActivity } from '../../../../lib/activity';

// Any member who's picked their name can add photos to an album -- same
// "public but gated on identity" bar as RSVP, not admin-only. Editing an
// album's title/description or deleting photos stays under /api/admin/*.
export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const albumId = Number(params.id);
	const album = await env.DB.prepare('SELECT id, slug, title, occurred_at FROM albums WHERE id = ?')
		.bind(albumId)
		.first<{ id: number; slug: string; title: string; occurred_at: string | null }>();
	if (!album) return new Response('Not found', { status: 404 });

	const form = await request.formData();
	const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
	await uploadPhotosToAlbum(env, { id: album.id, slug: album.slug, occurredAt: album.occurred_at }, files, identity.memberId);

	if (files.length > 0) {
		await logActivity(env, 'album_photos_added', identity.memberId, `Added ${files.length} file(s) to "${album.title}"`);
		await sendPushToAllExcept(env, identity.memberId, {
			title: `${identity.displayName} added photos`,
			body: `New photos in "${album.title}"`,
			url: `/albums/${album.slug}`,
		});
	}

	return redirect(`/albums/${album.slug}`);
};
