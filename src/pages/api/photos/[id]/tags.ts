import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// Called from the album lightbox via fetch(), not a page navigation -- both
// handlers return the photo's updated tag list as JSON so the client can
// re-render without a full reload. Open to any member who's picked their
// name, same bar as adding photos to an album in the first place.

async function currentTags(photoId: number) {
	const { results } = await env.DB.prepare(
		`SELECT members.id as member_id, members.display_name
		 FROM photo_tags JOIN members ON members.id = photo_tags.member_id
		 WHERE photo_tags.photo_id = ?
		 ORDER BY members.display_name`,
	)
		.bind(photoId)
		.all<{ member_id: number; display_name: string }>();
	return results;
}

export const POST: APIRoute = async ({ request, params, locals }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const photoId = Number(params.id);
	const form = await request.formData();
	const memberId = Number(form.get('memberId'));
	if (!memberId) return new Response('Bad request', { status: 400 });

	await env.DB.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, member_id) VALUES (?, ?)').bind(photoId, memberId).run();

	return new Response(JSON.stringify({ tags: await currentTags(photoId) }), { headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ url, params, locals }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const photoId = Number(params.id);
	const memberId = Number(url.searchParams.get('memberId'));
	if (!memberId) return new Response('Bad request', { status: 400 });

	await env.DB.prepare('DELETE FROM photo_tags WHERE photo_id = ? AND member_id = ?').bind(photoId, memberId).run();

	return new Response(JSON.stringify({ tags: await currentTags(photoId) }), { headers: { 'Content-Type': 'application/json' } });
};
