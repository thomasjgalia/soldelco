import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request, locals }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const { endpoint } = await request.json<{ endpoint: string }>();
	if (!endpoint) return new Response('Invalid request', { status: 400 });

	await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?').bind(endpoint, identity.memberId).run();

	return new Response(null, { status: 204 });
};
