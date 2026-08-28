import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../lib/admin';
import { sendPushToAll } from '../../../lib/push';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const form = await request.formData();
	const title = String(form.get('title') ?? '').trim();
	const body = String(form.get('body') ?? '').trim();
	const url = String(form.get('url') ?? '').trim() || undefined;
	if (!title || !body) return redirect('/admin/notify');

	const sentTo = await sendPushToAll(env, { title, body, url });

	return redirect(`/admin/notify?sent=${sentTo}`);
};
