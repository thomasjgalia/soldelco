import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadPhotosToAlbum } from '../../../../lib/photos';

// Any member who's picked their name can add photos to an album -- same
// "public but gated on identity" bar as RSVP, not admin-only. Editing an
// album's title/description or deleting photos stays under /api/admin/*.
export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const albumId = Number(params.id);
	const album = await env.DB.prepare('SELECT id, slug FROM albums WHERE id = ?').bind(albumId).first<{ id: number; slug: string }>();
	if (!album) return new Response('Not found', { status: 404 });

	const form = await request.formData();
	const files = form.getAll('files').filter((f): f is File => f instanceof File);
	await uploadPhotosToAlbum(env, album, files, identity.memberId);

	return redirect(`/albums/${album.slug}`);
};
