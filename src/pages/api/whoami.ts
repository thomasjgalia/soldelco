import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createIdentity, safeRedirect } from '../../lib/auth';
import { logActivity } from '../../lib/activity';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	const form = await request.formData();
	const target = safeRedirect(String(form.get('redirect') ?? ''));

	const memberIdRaw = form.get('memberId');
	const newName = String(form.get('newName') ?? '').trim();
	const passcodeAttempt = String(form.get('passcode') ?? '').trim();

	let member: { id: number; display_name: string; passcode: string | null } | null = null;

	if (memberIdRaw) {
		member = await env.DB.prepare('SELECT id, display_name, passcode FROM members WHERE id = ?')
			.bind(Number(memberIdRaw))
			.first<{ id: number; display_name: string; passcode: string | null }>();
	} else if (newName) {
		// A brand-new member never has a passcode yet, so this path is never
		// gated -- there'd be nothing to prove and no way to prove it.
		const inserted = await env.DB.prepare(
			'INSERT INTO members (display_name) VALUES (?) ON CONFLICT (display_name) DO UPDATE SET display_name = display_name RETURNING id, display_name, passcode',
		)
			.bind(newName)
			.first<{ id: number; display_name: string; passcode: string | null }>();
		member = inserted;
	}

	if (!member) {
		return redirect(`/whoami?redirect=${encodeURIComponent(target)}`);
	}

	// A member who has set a passcode (via /profile) needs it to be claimed
	// at all now, not just to edit their profile afterward -- stops someone
	// else from picking their name in the first place.
	if (member.passcode) {
		const ok = passcodeAttempt && passcodeAttempt.toLowerCase() === member.passcode.toLowerCase();
		if (!ok) {
			const err = passcodeAttempt ? '&error=1' : '';
			return redirect(`/whoami?requirePasscode=${member.id}&redirect=${encodeURIComponent(target)}${err}`);
		}
	}

	await createIdentity(cookies, env.IDENTITY_SECRET, member.id, member.display_name);
	await logActivity(env, 'profile_claim', member.id, `Claimed as ${member.display_name}`);
	return redirect(target);
};
