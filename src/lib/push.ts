import { buildPushHTTPRequest } from '@pushforge/builder';

type PushPayload = { title: string; body: string; url?: string };
type SubscriptionRow = { endpoint: string; p256dh: string; auth: string };

async function sendToSubscription(env: Env, row: SubscriptionRow, payload: PushPayload): Promise<void> {
	const privateJWK = JSON.parse(env.VAPID_PRIVATE_KEY);
	const { endpoint, headers, body } = await buildPushHTTPRequest({
		privateJWK,
		subscription: { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
		message: {
			payload,
			adminContact: 'mailto:tom.galia@outlook.com',
			options: { ttl: 3600, urgency: 'normal' },
		},
	});

	const res = await fetch(endpoint, { method: 'POST', headers, body });
	if (res.status === 404 || res.status === 410) {
		// Push service says this subscription is gone for good (browser
		// uninstalled/reset it) -- stop trying it on future sends.
		await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(row.endpoint).run();
	}
}

export async function sendPushToMember(env: Env, memberId: number, payload: PushPayload): Promise<void> {
	const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = ?')
		.bind(memberId)
		.all<SubscriptionRow>();
	await Promise.all(results.map((row) => sendToSubscription(env, row, payload)));
}

export async function sendPushToAll(env: Env, payload: PushPayload): Promise<number> {
	const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions').all<SubscriptionRow>();
	await Promise.all(results.map((row) => sendToSubscription(env, row, payload)));
	return results.length;
}
