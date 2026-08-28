import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadAvatar } from '../../lib/photos';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity) return new Response('Forbidden', { status: 403 });

	const member = await env.DB.prepare('SELECT id, avatar_key, passcode FROM members WHERE id = ?')
		.bind(identity.memberId)
		.first<{ id: number; avatar_key: string | null; passcode: string | null }>();
	if (!member) return new Response('Not found', { status: 404 });

	const form = await request.formData();

	// A passcode already set gates every edit, including changing the
	// passcode itself. No passcode yet means this is first-time setup --
	// nothing to prove, so the fields (including a first passcode) just save.
	if (member.passcode) {
		const currentPasscode = String(form.get('currentPasscode') ?? '').trim();
		if (!currentPasscode || currentPasscode.toLowerCase() !== member.passcode.toLowerCase()) {
			return redirect('/profile?error=passcode');
		}
	}

	const email = String(form.get('email') ?? '').trim() || null;
	const phone = String(form.get('phone') ?? '').trim() || null;
	const address = String(form.get('address') ?? '').trim() || null;
	// <input type="date"> submits a full YYYY-MM-DD -- only MM-DD is ever
	// stored (see the migration comment), the padded year gets dropped here.
	const birthdayRaw = String(form.get('birthday') ?? '').trim();
	const birthday = /^\d{4}-\d{2}-\d{2}$/.test(birthdayRaw) ? birthdayRaw.slice(5) : null;
	const newPasscode = String(form.get('newPasscode') ?? '').trim();

	const sets = ['email = ?', 'phone = ?', 'birthday = ?', 'address = ?'];
	const values: unknown[] = [email, phone, birthday, address];
	if (newPasscode) {
		sets.push('passcode = ?');
		values.push(newPasscode);
	}
	await env.DB.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`)
		.bind(...values, member.id)
		.run();

	const photo = form.get('photo');
	if (photo instanceof File) {
		await uploadAvatar(env, member.id, photo, member.avatar_key);
	}

	return redirect('/profile');
};
