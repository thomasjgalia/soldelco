import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadPostMedia } from '../../../lib/feed';
import { safeRedirect } from '../../../lib/auth';
import { sendPushToMember } from '../../../lib/push';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const form = await request.formData();
	const body = String(form.get('body') ?? '').trim() || null;
	const linkUrl = String(form.get('link_url') ?? '').trim() || null;
	const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
	const target = safeRedirect(String(form.get('redirect') ?? '/feed'));
	const tagIds = [...new Set(form.getAll('tagIds').map((v) => Number(v)).filter((id) => id && id !== identity.memberId))];

	if (!body && !linkUrl && files.length === 0) {
		return redirect(target);
	}

	const post = await env.DB.prepare('INSERT INTO posts (member_id, body, link_url) VALUES (?, ?, ?) RETURNING id')
		.bind(identity.memberId, body, linkUrl)
		.first<{ id: number }>();

	if (files.length > 0) await uploadPostMedia(env, post!.id, files);

	if (tagIds.length > 0) {
		await env.DB.batch(
			tagIds.map((memberId) => env.DB.prepare('INSERT INTO post_tags (post_id, member_id) VALUES (?, ?)').bind(post!.id, memberId)),
		);
		await Promise.all(
			tagIds.map((memberId) =>
				sendPushToMember(env, memberId, {
					title: `${identity.displayName} tagged you`,
					body: (body ?? 'in a post').slice(0, 120),
					url: '/feed',
				}),
			),
		);
	}

	return redirect(target);
};
