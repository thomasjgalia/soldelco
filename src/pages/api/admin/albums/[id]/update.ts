import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';
import { parseOccurredAt } from '../../../../../lib/albums';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const id = Number(params.id);
	const form = await request.formData();
	const title = String(form.get('title') ?? '').trim();
	const description = String(form.get('description') ?? '').trim();
	const isSolWeekend = form.get('isSolWeekend') ? 1 : 0;
	const occurredAt = parseOccurredAt(form.get('occurredAt'));

	if (title) {
		await env.DB.prepare('UPDATE albums SET title = ?, description = ?, is_sol_weekend = ?, occurred_at = ? WHERE id = ?')
			.bind(title, description || null, isSolWeekend, occurredAt, id)
			.run();
	}

	return redirect(`/admin/albums/${id}`);
};
