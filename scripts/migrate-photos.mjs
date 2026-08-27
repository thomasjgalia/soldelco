#!/usr/bin/env node
/**
 * One-time migration: takes cloudinary-albums.json (a snapshot of the
 * Cloudinary folder structure from the reference SOL repo, matched
 * 1:1 against the local photoscloudinary/ dump by publicId) and:
 *
 *   1. Generates SQL to create one `events` row + one linked `albums`
 *      row per Cloudinary folder ("2025, SOL April" -> Spring 2025 / Fall 2025).
 *   2. Uploads every photo/video from photoscloudinary/ to R2 under
 *      albums/{album-slug}/{uuid}.{ext}, with limited concurrency via
 *      the wrangler CLI (no R2 API credentials needed).
 *   3. Applies the generated SQL to the remote D1 database.
 *
 * Usage: node scripts/migrate-photos.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const execFileRaw = promisify(execFile);
const execFileAsync = (cmd, args) => execFileRaw(cmd, args, { shell: process.platform === 'win32' });

const ROOT = path.resolve(import.meta.dirname, '..');
const PHOTOS_DIR = path.join(ROOT, 'photoscloudinary');
const MANIFEST_PATH = path.join(ROOT, 'scripts', 'cloudinary-albums.json');
const SQL_PATH = path.join(ROOT, 'scripts', 'generated-migration.sql');
const WRANGLER_BIN = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
const BUCKET = 'soldelco-photos';
const CONCURRENCY = 6;

function slugify(input) {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function sqlEscape(value) {
	return value.replace(/'/g, "''");
}

function parseFolder(folder) {
	const match = folder.match(/^(\d{4}),\s*SOL\s+(\w+)$/i);
	if (!match) throw new Error(`Unrecognized folder name: ${folder}`);
	const [, year, month] = match;
	const season = month.toLowerCase() === 'april' ? 'Spring' : 'Fall';
	const monthNum = { april: '04', october: '10', november: '11' }[month.toLowerCase()];
	if (!monthNum) throw new Error(`Unrecognized month in folder: ${folder}`);
	return {
		title: `${season} ${year}`,
		slug: `${season.toLowerCase()}-${year}`,
		startsAt: `${year}-${monthNum}-01`,
	};
}

async function main() {
	if (!existsSync(MANIFEST_PATH)) {
		console.error(`Missing ${MANIFEST_PATH}`);
		process.exit(1);
	}
	if (!existsSync(PHOTOS_DIR)) {
		console.error(`Missing ${PHOTOS_DIR}`);
		process.exit(1);
	}

	const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
	const sqlLines = [];
	const uploads = [];

	for (const album of manifest.albums) {
		const event = parseFolder(album.folder);

		sqlLines.push(
			`INSERT INTO events (slug, title, starts_at) VALUES ('${event.slug}', '${sqlEscape(event.title)}', '${event.startsAt}') ON CONFLICT (slug) DO NOTHING;`,
		);
		sqlLines.push(
			`INSERT INTO albums (slug, title, event_id) VALUES ('${event.slug}', '${sqlEscape(event.title)}', (SELECT id FROM events WHERE slug = '${event.slug}')) ON CONFLICT (slug) DO NOTHING;`,
		);

		for (const img of album.images) {
			const ext = img.isVideo ? 'mov' : 'jpg';
			const localFile = path.join(PHOTOS_DIR, `${img.publicId}.${ext}`);
			if (!existsSync(localFile)) {
				throw new Error(`Expected local file not found: ${localFile}`);
			}
			const kind = img.isVideo ? 'video' : 'image';
			const contentType = img.isVideo ? 'video/quicktime' : 'image/jpeg';
			const r2Key = `albums/${event.slug}/${randomUUID()}.${ext}`;

			uploads.push({ localFile, r2Key, contentType });

			sqlLines.push(
				`INSERT INTO photos (album_id, r2_key, kind) VALUES ((SELECT id FROM albums WHERE slug = '${event.slug}'), '${r2Key}', '${kind}');`,
			);
		}
	}

	writeFileSync(SQL_PATH, sqlLines.join('\n') + '\n');
	console.log(`Wrote ${sqlLines.length} SQL statements to ${SQL_PATH}`);
	console.log(`Uploading ${uploads.length} files to R2 (concurrency ${CONCURRENCY})...`);

	let done = 0;
	let failed = 0;
	async function worker(queue) {
		for (const item of queue) {
			try {
				await execFileAsync(WRANGLER_BIN, [
					'r2',
					'object',
					'put',
					`${BUCKET}/${item.r2Key}`,
					'--file',
					item.localFile,
					'--content-type',
					item.contentType,
					'--remote',
				]);
			} catch (err) {
				failed++;
				console.error(`FAILED: ${item.localFile} -> ${item.r2Key}`, err.message);
			}
			done++;
			if (done % 10 === 0 || done === uploads.length) {
				console.log(`  ${done}/${uploads.length} uploaded`);
			}
		}
	}

	const queues = Array.from({ length: CONCURRENCY }, () => []);
	uploads.forEach((item, i) => queues[i % CONCURRENCY].push(item));
	await Promise.all(queues.map(worker));

	if (failed > 0) {
		console.error(`\n${failed} upload(s) failed. Fix and re-run before applying SQL (uploads are keyed by fresh UUIDs, so re-running is safe but will re-upload everything).`);
		process.exit(1);
	}

	console.log('\nAll uploads succeeded. Applying SQL to remote D1...');
	const { stdout, stderr } = await execFileAsync(WRANGLER_BIN, ['d1', 'execute', 'soldelco', '--remote', '--file', SQL_PATH]);
	console.log(stdout);
	if (stderr) console.error(stderr);
	console.log('Migration complete.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
