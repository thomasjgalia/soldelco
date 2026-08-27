import type { AstroCookies } from 'astro';
import { sign, verify } from './session';

export const IDENTITY_COOKIE = 'sol_identity';

const IDENTITY_TTL_MS = 1000 * 60 * 60 * 24 * 365; // 1 year

// Shared across soldelco.com and its subdomains (e.g. cornhole.soldelco.com)
// so a signed-in identity there is recognized here too. A Domain attribute
// only works when it matches the serving host, so it's skipped in local dev
// (localhost) where the browser would otherwise just reject the cookie.
const cookieOpts = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const,
	path: '/',
	...(import.meta.env.PROD ? { domain: '.soldelco.com' } : {}),
};

export interface Identity {
	memberId: number;
	displayName: string;
	exp: number;
}

export async function createIdentity(cookies: AstroCookies, secret: string, memberId: number, displayName: string) {
	const token = await sign(secret, { memberId, displayName, exp: Date.now() + IDENTITY_TTL_MS });
	cookies.set(IDENTITY_COOKIE, token, { ...cookieOpts, maxAge: IDENTITY_TTL_MS / 1000 });
}

export async function getIdentity(cookies: AstroCookies, secret: string): Promise<Identity | null> {
	const token = cookies.get(IDENTITY_COOKIE)?.value;
	return verify<Identity>(secret, token);
}

export function clearIdentity(cookies: AstroCookies) {
	cookies.delete(IDENTITY_COOKIE, { path: '/', ...(import.meta.env.PROD ? { domain: '.soldelco.com' } : {}) });
}

/** Only allow same-site relative redirects; falls back to `/` otherwise. */
export function safeRedirect(target: string | null | undefined): string {
	if (!target || !target.startsWith('/') || target.startsWith('//')) return '/';
	return target;
}
