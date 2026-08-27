import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const teamId = Number(params.id);
	const team = await env.DB.prepare('SELECT competition_id FROM teams WHERE id = ?')
		.bind(teamId)
		.first<{ competition_id: number }>();

	await env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(teamId).run();
	await env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(teamId).run();

	return redirect(team ? `/admin/competitions/${team.competition_id}` : '/admin/events');
};
