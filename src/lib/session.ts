const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function hmacKey(secret: string) {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
	const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let str = '';
	for (const b of arr) str += String.fromCharCode(b);
	return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
	const str = atob(padded);
	const arr = new Uint8Array(str.length);
	for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
	return arr;
}

/** Signs a JSON-serializable payload into a compact `payload.signature` token. */
export async function sign(secret: string, payload: Record<string, unknown>): Promise<string> {
	const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
	const key = await hmacKey(secret);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
	return `${payloadB64}.${toBase64Url(sig)}`;
}

/** Verifies a token produced by `sign`, returning the payload or null if invalid/expired. */
export async function verify<T extends { exp?: number }>(secret: string, token: string | undefined | null): Promise<T | null> {
	if (!token) return null;
	const [payloadB64, sigB64] = token.split('.');
	if (!payloadB64 || !sigB64) return null;

	const key = await hmacKey(secret);
	const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(sigB64), encoder.encode(payloadB64));
	if (!valid) return null;

	try {
		const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64))) as T;
		if (payload.exp && Date.now() > payload.exp) return null;
		return payload;
	} catch {
		return null;
	}
}
