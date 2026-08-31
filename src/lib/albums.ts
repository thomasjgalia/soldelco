import { slugify } from './slug';
import { logActivity } from './activity';

// Normalizes a raw <input type="date"> value ('YYYY-MM-DD') into what we
// store, or null if blank/malformed -- never trust client-submitted date
// strings verbatim into a column other queries sort by.
export function parseOccurredAt(raw: FormDataEntryValue | null): string | null {
	const value = String(raw ?? '').trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// Shared by both the admin and member-facing "create album" routes -- who's
// allowed to call it (and whether they can set is_sol_weekend) differs, but
// the slug-collision-retry insert doesn't.
export async function createAlbum(
	env: Env,
	opts: { title: string; createdBy: number; isSolWeekend: boolean; occurredAt: string | null },
): Promise<{ id: number; slug: string } | null> {
	const baseSlug = slugify(opts.title);
	let slug = baseSlug;

	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			const inserted = await env.DB.prepare(
				'INSERT INTO albums (slug, title, created_by, is_sol_weekend, occurred_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
			)
				.bind(slug, opts.title, opts.createdBy, opts.isSolWeekend ? 1 : 0, opts.occurredAt)
				.first<{ id: number }>();
			if (inserted) {
				await logActivity(env, 'album_created', opts.createdBy, `Created album "${opts.title}"`);
				return { id: inserted.id, slug };
			}
		} catch {
			slug = `${baseSlug}-${attempt + 2}`;
		}
	}
	return null;
}
