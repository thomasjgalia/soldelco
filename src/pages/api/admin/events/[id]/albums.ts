import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const eventId = Number(params.id);
	const form = await request.formData();
	const albumId = Number(form.get('albumId') ?? '') || null;

	await env.DB.prepare('UPDATE albums SET event_id = NULL WHERE event_id = ?').bind(eventId).run();

	if (albumId) {
		await env.DB.prepare('UPDATE albums SET event_id = ? WHERE id = ?').bind(eventId, albumId).run();
	}

	return redirect(`/admin/events/${eventId}`);
};
