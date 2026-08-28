import fs from 'node:fs';

const raw = fs.readFileSync('solcontacts.vcf', 'utf8');
const cards = raw.split(/(?=BEGIN:VCARD)/).filter((c) => c.trim().startsWith('BEGIN:VCARD'));

function unfold(text) {
	return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function parseCard(card) {
	const text = unfold(card);
	const lines = text
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);
	const out = { FN: null, TEL: [], EMAIL: [], BDAY: null, ADR: [] };
	for (const line of lines) {
		if (line.startsWith('PHOTO')) continue;
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		// Entries with a custom label (e.g. an "OTHER" email, an extra profile
		// URL) get grouped under an "item1.", "item2.", ... prefix -- strip it
		// before matching, or every field on a grouped line is silently missed.
		const key = line.slice(0, colonIdx).split(';')[0].toUpperCase().replace(/^ITEM\d+\./, '');
		const value = line.slice(colonIdx + 1);
		if (key === 'FN') out.FN = value;
		else if (key === 'TEL') out.TEL.push(value);
		else if (key === 'EMAIL') out.EMAIL.push(value);
		else if (key === 'BDAY') out.BDAY = value;
		else if (key === 'ADR') out.ADR.push(value);
	}
	return out;
}

function normalizePhone(raw) {
	const digits = raw.replace(/\D/g, '');
	const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
	if (ten.length !== 10) return raw;
	return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function normalizeBirthday(bday) {
	if (!bday) return null;
	const m = bday.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return null;
	return `${m[2]}-${m[3]}`;
}

function normalizeAddress(adrList) {
	if (adrList.length === 0) return null;
	// Prefer an entry with an escaped literal newline (proper street/city
	// separation) over one where they got concatenated with no separator.
	const preferred = adrList.find((a) => a.includes('\\n')) || adrList[0];
	const parts = preferred.split(';').map((p) => p.replace(/\\n/g, ', ').trim());
	const [, , street, city, state, zip] = parts;
	const bits = [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean);
	return bits.join(', ') || null;
}

const parsed = cards.map((c) => {
	const p = parseCard(c);
	return {
		name: p.FN,
		phone: p.TEL[0] ? normalizePhone(p.TEL[0]) : null,
		email: p.EMAIL[0] || null,
		birthday: normalizeBirthday(p.BDAY),
		address: normalizeAddress(p.ADR),
	};
});

console.log(JSON.stringify(parsed, null, 2));
