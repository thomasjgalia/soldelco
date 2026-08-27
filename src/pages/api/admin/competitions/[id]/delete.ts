import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const competitionId = Number(params.id);
	const competition = await env.DB.prepare('SELECT event_id FROM competitions WHERE id = ?')
		.bind(competitionId)
		.first<{ event_id: number }>();

	const { results: teams } = await env.DB.prepare('SELECT id FROM teams WHERE competition_id = ?')
		.bind(competitionId)
		.all<{ id: number }>();

	for (const team of teams) {
		await env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(team.id).run();
	}
	await env.DB.prepare('DELETE FROM teams WHERE competition_id = ?').bind(competitionId).run();
	await env.DB.prepare('DELETE FROM competitions WHERE id = ?').bind(competitionId).run();

	return redirect(competition ? `/admin/events/${competition.event_id}` : '/admin/events');
};
