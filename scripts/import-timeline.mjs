// One-time import of the personal photo/video archive in SOLTimeline/ into
// the Timeline feature (see the approved plan). Two modes:
//
//   node scripts/import-timeline.mjs            -- dry run (default): parses
//     every file's date/title, counts contained media, prints a review
//     table. No filesystem extraction, no D1/R2 writes.
//
//   node scripts/import-timeline.mjs --commit    -- unzips each archive to a
//     scratch dir, uploads every photo/video straight to R2 via wrangler
//     (bypassing the Worker's multipart upload path, which can't handle
//     files this large), and creates one `albums` row + one `photos` row
//     per file against the remote D1 database. Files over MAX_VIDEO_BYTES
//     are skipped (logged, not silently dropped) rather than uploaded --
//     the archive currently has one 307MB video that's not worth shipping.
//
// Filenames are the *only* usable date source (every photo's EXIF was
// stripped by whatever compression pipeline produced these -- confirmed by
// byte-scanning a sample before writing this). Patterns are tried
// most-specific first; anything that matches nothing is flagged, never
// guessed.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const execWrangler = (args) =>
	execFileAsync(WRANGLER_BIN, args, { shell: process.platform === 'win32', maxBuffer: 1024 * 1024 * 10 });

const ROOT = path.join(import.meta.dirname, '..');
const TIMELINE_DIR = path.join(ROOT, 'SOLTimeline');
const WRANGLER_BIN = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
const BUCKET = 'soldelco-photos';
const D1_DB = 'soldelco';
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB -- skip anything bigger, log it

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'heic', 'gif', 'webp']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'mpg', 'mpeg', 'avi', 'm4v']);

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

function titleCase(raw) {
	return raw
		.replace(/[_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.split(' ')
		.map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
		.join(' ');
}

function fullYear(yy) {
	const n = Number(yy);
	// 1980-2026 is the known real range of this archive -- 2-digit years in
	// that window are almost certainly 19xx below ~30, else 20xx. Adjust the
	// cutoff if the archive ever gets material from outside this range.
	return n <= 30 ? 2000 + n : 1900 + n;
}

function isValidMonth(m) {
	return m >= 1 && m <= 12;
}
function isValidDay(d) {
	return d >= 1 && d <= 31;
}

// Returns { date: 'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY', precision, title } or null.
function parseDateFromName(base) {
	let m;

	// MM[-_.]DD[-_.]YYYY[_]description
	if ((m = base.match(/^(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})(?:[_](.*))?$/))) {
		const mo = Number(m[1]);
		const day = Number(m[2]);
		const yr = Number(m[3]);
		if (isValidMonth(mo) && isValidDay(day)) {
			return {
				date: `${yr}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
				precision: 'day',
				title: m[4] ? titleCase(m[4]) : `${MONTH_NAMES[mo - 1]} ${day}, ${yr}`,
			};
		}
	}

	// MM[-_.]DD[-_.]YY[_]description  (2-digit year)
	if ((m = base.match(/^(\d{1,2})[-_.](\d{1,2})[-_.](\d{2})(?:[_](.*))?$/))) {
		const mo = Number(m[1]);
		const day = Number(m[2]);
		const yr = fullYear(m[3]);
		if (isValidMonth(mo) && isValidDay(day)) {
			return {
				date: `${yr}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
				precision: 'day',
				title: m[4] ? titleCase(m[4]) : `${MONTH_NAMES[mo - 1]} ${day}, ${yr}`,
			};
		}
	}

	// MM[-_.]YYYY[_]description
	if ((m = base.match(/^(\d{1,2})[-_.](\d{4})(?:[_](.*))?$/))) {
		const mo = Number(m[1]);
		const yr = Number(m[2]);
		if (isValidMonth(mo) && yr >= 1900 && yr <= 2099) {
			return {
				date: `${yr}-${String(mo).padStart(2, '0')}`,
				precision: 'month',
				title: m[3] ? titleCase(m[3]) : `${MONTH_NAMES[mo - 1]} ${yr}`,
			};
		}
	}

	// YYYY[_]description
	if ((m = base.match(/^(\d{4})(?:[_](.*))?$/))) {
		const yr = Number(m[1]);
		if (yr >= 1900 && yr <= 2099) {
			return {
				date: `${yr}`,
				precision: 'year',
				title: m[2] ? titleCase(m[2]) : `${yr}`,
			};
		}
	}

	// description_YYYY  (year at the end instead of the start)
	if ((m = base.match(/^(.+?)[-_](\d{4})$/))) {
		const yr = Number(m[2]);
		if (yr >= 1900 && yr <= 2099) {
			return { date: `${yr}`, precision: 'year', title: titleCase(m[1]) };
		}
	}

	// Last resort: a bare 4-digit 19xx/20xx anywhere in the name.
	if ((m = base.match(/(19|20)\d{2}/))) {
		const yr = Number(m[0]);
		const title = titleCase(base.replace(m[0], ' '));
		return { date: `${yr}`, precision: 'year', title: title || `${yr}` };
	}

	return null;
}

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

// Normalizes a parsed { date, precision } into a full YYYY-MM-DD for
// occurred_at/taken_at, matching the existing convention (migrate-photos.mjs
// uses YYYY-MM-01 for month-precision events).
function occurredAt(parsed) {
	if (parsed.precision === 'day') return parsed.date;
	if (parsed.precision === 'month') return `${parsed.date}-01`;
	return `${parsed.date}-01-01`;
}

const CONTENT_TYPES = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	heic: 'image/heic',
	gif: 'image/gif',
	webp: 'image/webp',
	mp4: 'video/mp4',
	mov: 'video/quicktime',
	mpg: 'video/mpeg',
	mpeg: 'video/mpeg',
	avi: 'video/x-msvideo',
	m4v: 'video/x-m4v',
};

function walkFiles(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith('.') || entry.name === '__MACOSX') continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walkFiles(full));
		else out.push(full);
	}
	return out;
}

function countMediaInZip(zipPath) {
	let listing;
	try {
		listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
	} catch (err) {
		return { images: 0, videos: 0, other: 0, error: String(err.message || err) };
	}
	let images = 0;
	let videos = 0;
	let other = 0;
	for (const line of listing.split('\n')) {
		const match = line.match(/\s(\S+\.(\w+))$/);
		if (!match) continue;
		const ext = match[2].toLowerCase();
		if (IMAGE_EXTS.has(ext)) images++;
		else if (VIDEO_EXTS.has(ext)) videos++;
		else if (ext !== 'zip') other++;
	}
	return { images, videos, other };
}

function buildRows() {
	const entries = fs.readdirSync(TIMELINE_DIR).filter((f) => !f.startsWith('.'));
	const rows = [];

	for (const entry of entries) {
		const ext = path.extname(entry).slice(1).toLowerCase();
		const base = path.basename(entry, path.extname(entry));
		const parsed = parseDateFromName(base);

		let counts;
		if (ext === 'zip') {
			counts = countMediaInZip(path.join(TIMELINE_DIR, entry));
		} else if (IMAGE_EXTS.has(ext)) {
			counts = { images: 1, videos: 0, other: 0 };
		} else if (VIDEO_EXTS.has(ext)) {
			counts = { images: 0, videos: 1, other: 0 };
		} else {
			counts = { images: 0, videos: 0, other: 1 };
		}

		rows.push({ file: entry, ext, parsed, counts });
	}

	rows.sort((a, b) => a.file.localeCompare(b.file));
	return rows;
}

function dryRun() {
	const rows = buildRows();

	console.log('\n%s | %s | %s | %s | %s', 'FILE'.padEnd(46), 'DATE'.padEnd(12), 'PRECISION'.padEnd(9), 'IMG/VID', 'PROPOSED TITLE');
	console.log('-'.repeat(140));

	let unparseable = 0;
	for (const row of rows) {
		const counts = `${row.counts.images}img/${row.counts.videos}vid${row.counts.other ? `/${row.counts.other}other` : ''}`;
		if (!row.parsed) {
			unparseable++;
			console.log('%s | %s | %s | %s | %s', row.file.padEnd(46), '?? UNPARSEABLE'.padEnd(12), '-'.padEnd(9), counts.padEnd(7), '(needs manual date/title)');
			continue;
		}
		console.log(
			'%s | %s | %s | %s | %s',
			row.file.padEnd(46),
			row.parsed.date.padEnd(12),
			row.parsed.precision.padEnd(9),
			counts.padEnd(7),
			row.parsed.title,
		);
	}

	const totalImages = rows.reduce((a, r) => a + r.counts.images, 0);
	const totalVideos = rows.reduce((a, r) => a + r.counts.videos, 0);
	const totalOther = rows.reduce((a, r) => a + r.counts.other, 0);
	console.log('-'.repeat(140));
	console.log(
		`${rows.length} files -> ${rows.length} proposed albums, ${totalImages} images, ${totalVideos} videos` +
			(totalOther ? `, ${totalOther} other/unrecognized files (will be skipped)` : '') +
			(unparseable ? `. ${unparseable} file(s) could not be dated -- needs manual input before --commit.` : '. All files dated successfully.'),
	);
	console.log('\nThis is a dry run -- nothing was extracted, uploaded, or written to any database.\n');
}

async function commit() {
	const rows = buildRows().filter((r) => r.parsed);
	const scratchRoot = path.join(os.tmpdir(), 'sol-timeline-import');
	fs.mkdirSync(scratchRoot, { recursive: true });

	const sqlLines = [];
	const uploads = [];
	let skippedLarge = [];

	for (const row of rows) {
		const slug = `${row.parsed.date}-${slugify(row.parsed.title)}`;
		const occurred = occurredAt(row.parsed);

		let files;
		if (row.ext === 'zip') {
			const extractDir = path.join(scratchRoot, slug);
			fs.rmSync(extractDir, { recursive: true, force: true });
			fs.mkdirSync(extractDir, { recursive: true });
			execFileSync('unzip', ['-q', '-o', path.join(TIMELINE_DIR, row.file), '-d', extractDir]);
			files = walkFiles(extractDir);
		} else {
			files = [path.join(TIMELINE_DIR, row.file)];
		}

		const mediaFiles = files.filter((f) => {
			const ext = path.extname(f).slice(1).toLowerCase();
			return IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext);
		});
		if (mediaFiles.length === 0) continue;

		sqlLines.push(
			`INSERT INTO albums (slug, title, event_id, occurred_at, is_sol_weekend) VALUES ('${slug}', '${sqlEscape(row.parsed.title)}', NULL, '${occurred}', 0) ON CONFLICT (slug) DO NOTHING;`,
		);

		for (const localFile of mediaFiles) {
			const ext = path.extname(localFile).slice(1).toLowerCase();
			const isVideo = VIDEO_EXTS.has(ext);
			const size = fs.statSync(localFile).size;
			if (isVideo && size > MAX_VIDEO_BYTES) {
				skippedLarge.push(`${localFile} (${(size / 1024 / 1024).toFixed(0)}MB)`);
				continue;
			}

			const r2Key = `timeline/${slug}/${randomUUID()}.${ext}`;
			uploads.push({ localFile, r2Key, contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream' });

			sqlLines.push(
				`INSERT INTO photos (album_id, r2_key, kind, taken_at) VALUES ((SELECT id FROM albums WHERE slug = '${slug}'), '${r2Key}', '${isVideo ? 'video' : 'image'}', '${occurred}');`,
			);
		}
	}

	if (skippedLarge.length > 0) {
		console.log(`Skipping ${skippedLarge.length} oversized video(s) (> ${MAX_VIDEO_BYTES / 1024 / 1024}MB):`);
		for (const f of skippedLarge) console.log(`  ${f}`);
	}

	const sqlPath = path.join(ROOT, 'scripts', 'generated-timeline-migration.sql');
	fs.writeFileSync(sqlPath, sqlLines.join('\n') + '\n');
	console.log(`\nWrote ${sqlLines.length} SQL statements to ${sqlPath}`);
	console.log(`Uploading ${uploads.length} files to R2...`);

	const CONCURRENCY = 6;
	let done = 0;
	let failed = 0;
	async function putOnce(item) {
		await execWrangler(['r2', 'object', 'put', `${BUCKET}/${item.r2Key}`, '--file', item.localFile, '--content-type', item.contentType, '--remote']);
	}
	async function worker(queue) {
		for (const item of queue) {
			try {
				await putOnce(item);
			} catch {
				// Transient network/rate-limit blips are common under concurrency;
				// one retry clears most of them without re-uploading everything.
				try {
					await putOnce(item);
				} catch (err) {
					failed++;
					console.error(`FAILED: ${item.localFile} -> ${item.r2Key}`, err.message);
				}
			}
			done++;
			if (done % 10 === 0 || done === uploads.length) console.log(`  ${done}/${uploads.length} uploaded`);
		}
	}
	const queues = Array.from({ length: CONCURRENCY }, () => []);
	uploads.forEach((item, i) => queues[i % CONCURRENCY].push(item));
	await Promise.all(queues.map(worker));

	if (failed > 0) {
		console.error(`\n${failed} upload(s) failed. Fix and re-run before applying SQL (re-running is safe -- uploads use fresh UUIDs and album inserts are ON CONFLICT DO NOTHING).`);
		process.exit(1);
	}

	console.log('\nAll uploads succeeded. Applying SQL to remote D1...');
	const { stdout, stderr } = await execWrangler(['d1', 'execute', D1_DB, '--remote', '--file', sqlPath]);
	console.log(stdout);
	if (stderr) console.error(stderr);
	console.log('Import complete.');
}

if (process.argv.includes('--commit')) {
	commit().catch((err) => {
		console.error(err);
		process.exit(1);
	});
} else {
	dryRun();
}
