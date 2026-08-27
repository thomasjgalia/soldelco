import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const id = Number(params.id);
	const form = await request.formData();
	const title = String(form.get('title') ?? '').trim();
	const location = String(form.get('location') ?? '').trim() || null;
	const startsAt = String(form.get('starts_at') ?? '').trim() || null;
	const endsAt = String(form.get('ends_at') ?? '').trim() || null;
	const description = String(form.get('description') ?? '').trim() || null;

	if (title) {
		await env.DB.prepare(
			'UPDATE events SET title = ?, location = ?, starts_at = ?, ends_at = ?, description = ? WHERE id = ?',
		)
			.bind(title, location, startsAt, endsAt, description, id)
			.run();
	}

	return redirect(`/admin/events/${id}`);
};
