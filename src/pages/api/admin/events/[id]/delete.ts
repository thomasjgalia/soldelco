import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const eventId = Number(params.id);

	const { results: forms } = await env.DB.prepare('SELECT id FROM rsvp_forms WHERE event_id = ?')
		.bind(eventId)
		.all<{ id: number }>();

	for (const form of forms) {
		await env.DB.prepare('DELETE FROM rsvp_responses WHERE form_id = ?').bind(form.id).run();
	}
	await env.DB.prepare('DELETE FROM rsvp_forms WHERE event_id = ?').bind(eventId).run();

	const { results: competitions } = await env.DB.prepare('SELECT id FROM competitions WHERE event_id = ?')
		.bind(eventId)
		.all<{ id: number }>();

	for (const competition of competitions) {
		const { results: teams } = await env.DB.prepare('SELECT id FROM teams WHERE competition_id = ?')
			.bind(competition.id)
			.all<{ id: number }>();
		for (const team of teams) {
			await env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(team.id).run();
		}
		await env.DB.prepare('DELETE FROM teams WHERE competition_id = ?').bind(competition.id).run();
	}
	await env.DB.prepare('DELETE FROM competitions WHERE event_id = ?').bind(eventId).run();

	await env.DB.prepare('UPDATE albums SET event_id = NULL WHERE event_id = ?').bind(eventId).run();
	await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(eventId).run();

	return redirect('/admin/events');
};
