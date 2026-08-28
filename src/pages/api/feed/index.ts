import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadPostMedia } from '../../../lib/feed';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const form = await request.formData();
	const body = String(form.get('body') ?? '').trim() || null;
	const linkUrl = String(form.get('link_url') ?? '').trim() || null;
	const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

	if (!body && !linkUrl && files.length === 0) {
		return redirect('/feed');
	}

	const post = await env.DB.prepare('INSERT INTO posts (member_id, body, link_url) VALUES (?, ?, ?) RETURNING id')
		.bind(identity.memberId, body, linkUrl)
		.first<{ id: number }>();

	if (files.length > 0) await uploadPostMedia(env, post!.id, files);

	return redirect('/feed');
};
