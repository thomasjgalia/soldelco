import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// Feed-media equivalent of /api/photos/[id]/tags.ts -- see that file for
// the rationale (called from a lightbox via fetch(), returns JSON so the
// client can re-render without a reload).

async function currentTags(mediaId: number) {
	const { results } = await env.DB.prepare(
		`SELECT members.id as member_id, members.display_name
		 FROM post_media_tags JOIN members ON members.id = post_media_tags.member_id
		 WHERE post_media_tags.media_id = ?
		 ORDER BY members.display_name`,
	)
		.bind(mediaId)
		.all<{ member_id: number; display_name: string }>();
	return results;
}

export const POST: APIRoute = async ({ request, params, locals }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const mediaId = Number(params.id);
	const form = await request.formData();
	const memberId = Number(form.get('memberId'));
	if (!memberId) return new Response('Bad request', { status: 400 });

	await env.DB.prepare('INSERT OR IGNORE INTO post_media_tags (media_id, member_id) VALUES (?, ?)').bind(mediaId, memberId).run();

	return new Response(JSON.stringify({ tags: await currentTags(mediaId) }), { headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ url, params, locals }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const mediaId = Number(params.id);
	const memberId = Number(url.searchParams.get('memberId'));
	if (!memberId) return new Response('Bad request', { status: 400 });

	await env.DB.prepare('DELETE FROM post_media_tags WHERE media_id = ? AND member_id = ?').bind(mediaId, memberId).run();

	return new Response(JSON.stringify({ tags: await currentTags(mediaId) }), { headers: { 'Content-Type': 'application/json' } });
};
