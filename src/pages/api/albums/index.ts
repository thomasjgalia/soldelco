import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createAlbum } from '../../../lib/albums';

// Any member who's picked their name can create an album -- same bar as
// adding photos to one (see src/pages/api/albums/[id]/photos.ts). Member-
// created albums are never auto-flagged as a SOL Weekend; that curation
// stays an admin-only judgment call, made afterward in /admin/albums/[id].
export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const form = await request.formData();
	const title = String(form.get('title') ?? '').trim();
	if (!title) return redirect('/albums');

	const album = await createAlbum(env, { title, createdBy: identity.memberId, isSolWeekend: false });
	if (!album) return redirect('/albums');

	return redirect(`/albums/${album.slug}`);
};
