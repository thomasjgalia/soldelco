import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const id = Number(params.id);
	const post = await env.DB.prepare('SELECT member_id FROM posts WHERE id = ?').bind(id).first<{ member_id: number }>();
	if (!post) return redirect('/feed');
	if (post.member_id !== identity.memberId) return new Response('Forbidden', { status: 403 });

	const form = await request.formData();
	const body = String(form.get('body') ?? '').trim() || null;
	const linkUrl = String(form.get('link_url') ?? '').trim() || null;

	await env.DB.prepare("UPDATE posts SET body = ?, link_url = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(body, linkUrl, id)
		.run();

	return redirect('/feed');
};
