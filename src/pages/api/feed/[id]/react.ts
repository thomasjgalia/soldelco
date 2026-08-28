import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const id = Number(params.id);
	const existing = await env.DB.prepare("SELECT id FROM reactions WHERE target_type = 'post' AND target_id = ? AND member_id = ?")
		.bind(id, identity.memberId)
		.first();

	if (existing) {
		await env.DB.prepare('DELETE FROM reactions WHERE id = ?').bind((existing as { id: number }).id).run();
	} else {
		await env.DB.prepare("INSERT INTO reactions (target_type, target_id, member_id, kind) VALUES ('post', ?, ?, 'heart')")
			.bind(id, identity.memberId)
			.run();
	}

	return redirect('/feed');
};
