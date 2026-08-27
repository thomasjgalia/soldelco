import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const formId = Number(params.formId);
	const rsvpForm = await env.DB.prepare('SELECT id, event_id, closes_at FROM rsvp_forms WHERE id = ?')
		.bind(formId)
		.first<{ id: number; event_id: number; closes_at: string | null }>();

	if (!rsvpForm) return new Response('Not found', { status: 404 });
	if (rsvpForm.closes_at && new Date(rsvpForm.closes_at) < new Date()) {
		return new Response('RSVPs are closed', { status: 400 });
	}

	const submitted = await request.formData();
	const attending = String(submitted.get('attending') ?? '');
	if (attending !== 'yes' && attending !== 'no') {
		return new Response('Invalid response', { status: 400 });
	}

	await env.DB.prepare(
		`INSERT INTO rsvp_responses (form_id, member_id, attending, updated_at)
		 VALUES (?, ?, ?, datetime('now'))
		 ON CONFLICT (form_id, member_id) DO UPDATE SET attending = excluded.attending, updated_at = excluded.updated_at`,
	)
		.bind(formId, identity.memberId, attending)
		.run();

	const event = await env.DB.prepare('SELECT slug FROM events WHERE id = ?').bind(rsvpForm.event_id).first<{ slug: string }>();
	return redirect(`/events/${event?.slug ?? ''}`);
};
