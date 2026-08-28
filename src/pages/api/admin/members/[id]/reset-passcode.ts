import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const memberId = Number(params.id);
	await env.DB.prepare('UPDATE members SET passcode = NULL WHERE id = ?').bind(memberId).run();

	return redirect('/admin/members');
};
