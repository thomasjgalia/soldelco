import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { sendPushToMember } from '../../../../lib/push';

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

		// Only on adding a reaction, not removing one -- mirrors reply.ts's
		// existing notify-the-author pattern, which reactions never had.
		const post = await env.DB.prepare("SELECT member_id FROM posts WHERE id = ?").bind(id).first<{ member_id: number }>();
		if (post && post.member_id !== identity.memberId) {
			await sendPushToMember(env, post.member_id, {
				title: `${identity.displayName} reacted to your post`,
				body: 'Check the feed',
				url: '/feed',
			});
		}
	}

	return redirect('/feed');
};
