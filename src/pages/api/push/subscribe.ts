import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request, locals }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const sub = await request.json<{ endpoint: string; keys: { p256dh: string; auth: string } }>();
	if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
		return new Response('Invalid subscription', { status: 400 });
	}

	// A device re-subscribing (e.g. after being un-registered by the browser)
	// gets a fresh endpoint, but the same physical device could also switch
	// which member it's signed in as -- upsert on endpoint either way.
	await env.DB.prepare(
		`INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
		 ON CONFLICT (endpoint) DO UPDATE SET member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth`,
	)
		.bind(identity.memberId, sub.endpoint, sub.keys.p256dh, sub.keys.auth)
		.run();

	return new Response(null, { status: 204 });
};
