export type ActivityEventType = 'profile_claim' | 'post_created' | 'reply_created' | 'reaction_added' | 'album_created' | 'album_photos_added';

export async function logActivity(env: Env, eventType: ActivityEventType, memberId: number, detail: string): Promise<void> {
	await env.DB.prepare('INSERT INTO activity_log (event_type, member_id, detail) VALUES (?, ?, ?)').bind(eventType, memberId, detail).run();
}
