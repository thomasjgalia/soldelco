import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../../../../lib/admin';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
	const identity = locals.identity;
	if (!identity || !(await isAdmin(identity.memberId))) {
		return new Response('Forbidden', { status: 403 });
	}

	const albumId = Number(params.id);
	const album = await env.DB.prepare('SELECT slug FROM albums WHERE id = ?').bind(albumId).first<{ slug: string }>();
	if (!album) return redirect('/admin/albums');

	const form = await request.formData();
	const files = form.getAll('files').filter((f): f is File => f instanceof File);

	for (const file of files) {
		if (file.size === 0) continue;
		const isImage = file.type.startsWith('image/');
		const isVideo = file.type.startsWith('video/');
		if (!isImage && !isVideo) continue;

		const ext = file.name.split('.').pop()?.toLowerCase() || (isImage ? 'jpg' : 'mov');
		const key = `albums/${album.slug}/${crypto.randomUUID()}.${ext}`;

		let width: number | null = null;
		let height: number | null = null;
		if (isImage) {
			try {
				const info = await env.IMAGES.info(file.stream());
				if ('width' in info) {
					width = info.width;
					height = info.height;
				}
			} catch {
				// Not a format the Images binding can introspect; store without dimensions.
			}
		}

		await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

		await env.DB.prepare(
			'INSERT INTO photos (album_id, r2_key, kind, width, height, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
		)
			.bind(albumId, key, isImage ? 'image' : 'video', width, height, identity.memberId)
			.run();
	}

	return redirect(`/admin/albums/${albumId}`);
};
