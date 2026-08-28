// Feed post media -- same shape as album photos, but keyed under posts/ and
// tied to a post rather than an album.

export async function uploadPostMedia(env: Env, postId: number, files: File[]): Promise<void> {
	for (const file of files) {
		if (file.size === 0) continue;
		const isImage = file.type.startsWith('image/');
		const isVideo = file.type.startsWith('video/');
		if (!isImage && !isVideo) continue;

		const ext = file.name.split('.').pop()?.toLowerCase() || (isImage ? 'jpg' : 'mov');
		const key = `posts/${postId}/${crypto.randomUUID()}.${ext}`;

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

		await env.DB.prepare('INSERT INTO post_media (post_id, r2_key, kind, width, height) VALUES (?, ?, ?, ?, ?)')
			.bind(postId, key, isImage ? 'image' : 'video', width, height)
			.run();
	}
}

// Deletes a post's R2 media, its media/comment/reaction rows, then the post
// itself. Used by both the author's own delete and the admin override.
export async function deletePost(env: Env, postId: number): Promise<void> {
	const { results: media } = await env.DB.prepare('SELECT r2_key FROM post_media WHERE post_id = ?')
		.bind(postId)
		.all<{ r2_key: string }>();
	await Promise.all(media.map((m) => env.PHOTOS.delete(m.r2_key)));

	await env.DB.batch([
		env.DB.prepare('DELETE FROM post_media WHERE post_id = ?').bind(postId),
		env.DB.prepare("DELETE FROM comments WHERE target_type = 'post' AND target_id = ?").bind(postId),
		env.DB.prepare("DELETE FROM reactions WHERE target_type = 'post' AND target_id = ?").bind(postId),
		env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId),
	]);
}
