import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createIdentity, safeRedirect } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	const form = await request.formData();
	const target = safeRedirect(String(form.get('redirect') ?? ''));

	const memberIdRaw = form.get('memberId');
	const newName = String(form.get('newName') ?? '').trim();

	let member: { id: number; display_name: string } | null = null;

	if (memberIdRaw) {
		member = await env.DB.prepare('SELECT id, display_name FROM members WHERE id = ?')
			.bind(Number(memberIdRaw))
			.first<{ id: number; display_name: string }>();
	} else if (newName) {
		const inserted = await env.DB.prepare(
			'INSERT INTO members (display_name) VALUES (?) ON CONFLICT (display_name) DO UPDATE SET display_name = display_name RETURNING id, display_name',
		)
			.bind(newName)
			.first<{ id: number; display_name: string }>();
		member = inserted;
	}

	if (!member) {
		return redirect(`/whoami?redirect=${encodeURIComponent(target)}`);
	}

	await createIdentity(cookies, env.IDENTITY_SECRET, member.id, member.display_name);
	return redirect(target);
};
