// Shared by both the admin and member-facing upload routes -- who's allowed
// to call it differs, but writing a photo into R2 + `photos` doesn't.

export async function uploadPhotosToAlbum(
	env: Env,
	album: { id: number; slug: string },
	files: File[],
	uploadedByMemberId: number,
): Promise<void> {
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

		await env.DB.prepare('INSERT INTO photos (album_id, r2_key, kind, width, height, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
			.bind(album.id, key, isImage ? 'image' : 'video', width, height, uploadedByMemberId)
			.run();
	}
}

// Stores a member's profile photo and deletes their previous one (unlike
// album photos, which intentionally accumulate, a profile has exactly one
// current avatar -- leaving old ones in R2 would just be orphaned storage).
export async function uploadAvatar(env: Env, memberId: number, file: File, previousAvatarKey: string | null): Promise<string | null> {
	if (file.size === 0 || !file.type.startsWith('image/')) return null;

	const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
	const key = `avatars/${memberId}-${crypto.randomUUID()}.${ext}`;

	await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
	await env.DB.prepare('UPDATE members SET avatar_key = ? WHERE id = ?').bind(key, memberId).run();

	if (previousAvatarKey) await env.PHOTOS.delete(previousAvatarKey);

	return key;
}
