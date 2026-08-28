import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const id = Number(params.id);
	const comment = await env.DB.prepare("SELECT member_id FROM comments WHERE id = ? AND target_type = 'post'")
		.bind(id)
		.first<{ member_id: number }>();
	if (!comment) return redirect('/feed');

	const isOwn = comment.member_id === identity.memberId;
	if (!isOwn && !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
	return redirect('/feed');
};
