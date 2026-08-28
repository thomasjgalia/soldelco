import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const competitionId = Number(params.id);
	const competition = await env.DB.prepare('SELECT kind FROM competitions WHERE id = ?')
		.bind(competitionId)
		.first<{ kind: string }>();
	if (!competition) return redirect('/admin/events');

	const form = await request.formData();
	const name = String(form.get('name') ?? '').trim();
	if (!name) return redirect(`/admin/competitions/${competitionId}`);

	const isGolf = competition.kind === 'score';
	const scoreRaw = form.get('score');
	const placementRaw = form.get('placement');
	const score = isGolf && scoreRaw ? Number(scoreRaw) : null;
	const placement = !isGolf && placementRaw ? Number(placementRaw) : null;

	const team = await env.DB.prepare('INSERT INTO teams (competition_id, name, score, placement) VALUES (?, ?, ?, ?) RETURNING id')
		.bind(competitionId, name, score, placement)
		.first<{ id: number }>();

	const memberIds = form.getAll('memberIds').map((v) => Number(v));
	for (const memberId of memberIds) {
		await env.DB.prepare('INSERT INTO team_members (team_id, member_id) VALUES (?, ?)').bind(team?.id, memberId).run();
	}

	return redirect(`/admin/competitions/${competitionId}`);
};
