import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../lib/admin';
import { createAlbum } from '../../../../lib/albums';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const form = await request.formData();
	const title = String(form.get('title') ?? '').trim();
	if (!title) return redirect('/admin/albums');
	const isSolWeekend = Boolean(form.get('isSolWeekend'));

	const album = await createAlbum(env, { title, createdBy: identity.memberId, isSolWeekend });

	return redirect(`/admin/albums/${album?.id}`);
};
