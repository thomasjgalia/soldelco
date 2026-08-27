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
	const kind = String(form.get('kind') ?? '');
	const title = String(form.get('title') ?? '').trim();
	const playedOn = String(form.get('played_on') ?? '').trim() || null;

	if (!title || (kind !== 'golf_scramble' && kind !== 'cornhole')) {
		return redirect(`/admin/events/${eventId}`);
	}

	const inserted = await env.DB.prepare(
		'INSERT INTO competitions (event_id, kind, title, played_on) VALUES (?, ?, ?, ?) RETURNING id',
	)
		.bind(eventId, kind, title, playedOn)
		.first<{ id: number }>();

	return redirect(`/admin/competitions/${inserted?.id}`);
};
