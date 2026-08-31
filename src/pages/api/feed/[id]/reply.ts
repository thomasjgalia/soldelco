import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { sendPushToMember } from '../../../../lib/push';
import { logActivity } from '../../../../lib/activity';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const id = Number(params.id);
	const post = await env.DB.prepare('SELECT member_id FROM posts WHERE id = ?').bind(id).first<{ member_id: number }>();
	if (!post) return redirect('/feed');

	const form = await request.formData();
	const body = String(form.get('body') ?? '').trim();
	if (!body) return redirect('/feed');

	await env.DB.prepare("INSERT INTO comments (target_type, target_id, member_id, body) VALUES ('post', ?, ?, ?)")
		.bind(id, identity.memberId, body)
		.run();

	await logActivity(env, 'reply_created', identity.memberId, body.slice(0, 100));

	// Notify the post's author that someone replied -- not the replier
	// themselves, and not a broadcast to everyone (that's what /admin/notify
	// is for), just the one person whose thread this is.
	if (post.member_id !== identity.memberId) {
		await sendPushToMember(env, post.member_id, {
			title: `${identity.displayName} replied to your post`,
			body: body.slice(0, 120),
			url: '/feed',
		});
	}

	return redirect('/feed');
};
