import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../lib/admin';
import { deletePost } from '../../../../lib/feed';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const id = Number(params.id);
	const post = await env.DB.prepare('SELECT member_id FROM posts WHERE id = ?').bind(id).first<{ member_id: number }>();
	if (!post) return redirect('/feed');

	const isOwn = post.member_id === identity.memberId;
	if (!isOwn && !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	await deletePost(env, id);
	return redirect('/feed');
};
