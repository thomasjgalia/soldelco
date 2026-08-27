import { env } from 'cloudflare:workers';

export async function isAdmin(memberId: number): Promise<boolean> {
	const row = await env.DB.prepare('SELECT is_admin FROM members WHERE id = ?').bind(memberId).first<{ is_admin: number }>();
	return !!row?.is_admin;
}
