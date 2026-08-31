import type { Identity } from './auth';

export type FeedPost = {
	id: number;
	body: string | null;
	link_url: string | null;
	created_at: string;
	updated_at: string;
	author_id: number;
	author_name: string;
	avatar_key: string | null;
	media: { id: number; r2_key: string; kind: string; poster_key: string | null; tags: { member_id: number; display_name: string }[] }[];
	replies: { id: number; body: string; created_at: string; member_id: number; display_name: string; avatar_key: string | null }[];
	tags: { member_id: number; display_name: string }[];
	reactionCount: number;
	iReacted: boolean;
	isOwn: boolean;
};

// Fully hydrates the most recent posts (media, replies, reactions, tags) for
// rendering -- shared by the feed page and the homepage's recent-posts strip
// so the two don't drift out of sync on what a "post" looks like.
export async function getRecentPosts(env: Env, identity: Identity | null, limit: number): Promise<FeedPost[]> {
	const { results: rawPosts } = await env.DB.prepare(
		`SELECT posts.id, posts.body, posts.link_url, posts.created_at, posts.updated_at,
			members.id as author_id, members.display_name as author_name, members.avatar_key
		 FROM posts JOIN members ON members.id = posts.member_id
		 ORDER BY posts.created_at DESC
		 LIMIT ?`,
	)
		.bind(limit)
		.all<Omit<FeedPost, 'media' | 'replies' | 'tags' | 'reactionCount' | 'iReacted' | 'isOwn'>>();

	return Promise.all(
		rawPosts.map(async (post) => {
			const { results: media } = await env.DB.prepare('SELECT id, r2_key, kind, poster_key FROM post_media WHERE post_id = ? ORDER BY created_at')
				.bind(post.id)
				.all<{ id: number; r2_key: string; kind: string; poster_key: string | null }>();

			const mediaWithTags = await Promise.all(
				media.map(async (m) => {
					const { results: mediaTags } = await env.DB.prepare(
						`SELECT members.id as member_id, members.display_name
						 FROM post_media_tags JOIN members ON members.id = post_media_tags.member_id
						 WHERE post_media_tags.media_id = ?
						 ORDER BY members.display_name`,
					)
						.bind(m.id)
						.all<{ member_id: number; display_name: string }>();
					return { ...m, tags: mediaTags };
				}),
			);

			const { results: replies } = await env.DB.prepare(
				`SELECT comments.id, comments.body, comments.created_at, comments.member_id, members.display_name, members.avatar_key
				 FROM comments JOIN members ON members.id = comments.member_id
				 WHERE comments.target_type = 'post' AND comments.target_id = ?
				 ORDER BY comments.created_at`,
			)
				.bind(post.id)
				.all<{ id: number; body: string; created_at: string; member_id: number; display_name: string; avatar_key: string | null }>();

			const { results: tags } = await env.DB.prepare(
				`SELECT members.id as member_id, members.display_name
				 FROM post_tags JOIN members ON members.id = post_tags.member_id
				 WHERE post_tags.post_id = ?`,
			)
				.bind(post.id)
				.all<{ member_id: number; display_name: string }>();

			const { results: reactionRows } = await env.DB.prepare("SELECT member_id FROM reactions WHERE target_type = 'post' AND target_id = ?")
				.bind(post.id)
				.all<{ member_id: number }>();

			return {
				...post,
				media: mediaWithTags,
				replies,
				tags,
				reactionCount: reactionRows.length,
				iReacted: identity ? reactionRows.some((r) => r.member_id === identity.memberId) : false,
				isOwn: identity?.memberId === post.author_id,
			};
		}),
	);
}

// Feed post media -- same shape as album photos, but keyed under posts/ and
// tied to a post rather than an album.

// A poster frame the client captured from a video before upload is sent as
// a plain image file immediately after its video in the same `files` list,
// named with this marker prefix. The client controls that ordering (see
// ComposeDialog.astro's submit handler); this function trusts it rather
// than trying to correlate across separate requests.
const POSTER_MARKER = '__poster__.';

export async function uploadPostMedia(env: Env, postId: number, files: File[]): Promise<void> {
	let lastVideoMediaId: number | null = null;

	for (const file of files) {
		if (file.size === 0) continue;
		const isImage = file.type.startsWith('image/');
		const isVideo = file.type.startsWith('video/');
		if (!isImage && !isVideo) continue;

		if (isImage && lastVideoMediaId !== null && file.name.startsWith(POSTER_MARKER)) {
			const key = `posts/${postId}/${crypto.randomUUID()}.jpg`;
			await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
			await env.DB.prepare('UPDATE post_media SET poster_key = ? WHERE id = ?').bind(key, lastVideoMediaId).run();
			lastVideoMediaId = null;
			continue;
		}

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

		const inserted = await env.DB.prepare('INSERT INTO post_media (post_id, r2_key, kind, width, height) VALUES (?, ?, ?, ?, ?) RETURNING id')
			.bind(postId, key, isImage ? 'image' : 'video', width, height)
			.first<{ id: number }>();

		lastVideoMediaId = isVideo ? (inserted?.id ?? null) : null;
	}
}

// Deletes a post's R2 media, its media/comment/reaction rows, then the post
// itself. Used by both the author's own delete and the admin override.
export async function deletePost(env: Env, postId: number): Promise<void> {
	const { results: media } = await env.DB.prepare('SELECT id, r2_key, poster_key FROM post_media WHERE post_id = ?')
		.bind(postId)
		.all<{ id: number; r2_key: string; poster_key: string | null }>();
	await Promise.all(
		media.flatMap((m) => [env.PHOTOS.delete(m.r2_key), ...(m.poster_key ? [env.PHOTOS.delete(m.poster_key)] : [])]),
	);

	await env.DB.batch([
		...media.map((m) => env.DB.prepare('DELETE FROM post_media_tags WHERE media_id = ?').bind(m.id)),
		env.DB.prepare('DELETE FROM post_media WHERE post_id = ?').bind(postId),
		env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(postId),
		env.DB.prepare("DELETE FROM comments WHERE target_type = 'post' AND target_id = ?").bind(postId),
		env.DB.prepare("DELETE FROM reactions WHERE target_type = 'post' AND target_id = ?").bind(postId),
		env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId),
	]);
}
