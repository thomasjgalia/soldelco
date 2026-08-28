import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const competitionId = Number(params.competitionId);
	const competition = await env.DB.prepare('SELECT id, event_id, rsvp_closes_at FROM competitions WHERE id = ?')
		.bind(competitionId)
		.first<{ id: number; event_id: number; rsvp_closes_at: string | null }>();

	if (!competition) return new Response('Not found', { status: 404 });
	if (competition.rsvp_closes_at && new Date(competition.rsvp_closes_at) < new Date()) {
		return new Response('RSVPs are closed', { status: 400 });
	}

	const submitted = await request.formData();
	const attending = String(submitted.get('attending') ?? '');
	if (attending !== 'yes' && attending !== 'no' && attending !== 'maybe') {
		return new Response('Invalid response', { status: 400 });
	}

	await env.DB.prepare(
		`INSERT INTO rsvp_responses (competition_id, member_id, attending, updated_at)
		 VALUES (?, ?, ?, datetime('now'))
		 ON CONFLICT (competition_id, member_id) DO UPDATE SET attending = excluded.attending, updated_at = excluded.updated_at`,
	)
		.bind(competitionId, identity.memberId, attending)
		.run();

	const event = await env.DB.prepare('SELECT slug FROM events WHERE id = ?').bind(competition.event_id).first<{ slug: string }>();
	return redirect(`/events/${event?.slug ?? ''}`);
};
