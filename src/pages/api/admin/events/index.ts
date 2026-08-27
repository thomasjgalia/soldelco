import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../lib/admin';
import { slugify } from '../../../../lib/slug';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const form = await request.formData();
	const title = String(form.get('title') ?? '').trim();
	if (!title) return redirect('/admin/events');

	const location = String(form.get('location') ?? '').trim() || null;
	const startsAt = String(form.get('starts_at') ?? '').trim() || null;
	const endsAt = String(form.get('ends_at') ?? '').trim() || null;

	const baseSlug = slugify(title);
	let slug = baseSlug;
	let inserted: { id: number } | null = null;

	for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
		try {
			inserted = await env.DB.prepare(
				'INSERT INTO events (slug, title, location, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
			)
				.bind(slug, title, location, startsAt, endsAt, identity.memberId)
				.first<{ id: number }>();
		} catch {
			slug = `${baseSlug}-${attempt + 2}`;
		}
	}

	return redirect(`/admin/events/${inserted?.id}`);
};
