// SQLite's datetime('now') is UTC with no offset marker -- append one so
// Date parses it as UTC rather than assuming the server's local time, then
// render in Eastern (where the group actually is) as "MM/DD/YY H:MM AM/PM".
export function formatTimestamp(sqliteUtc: string): string {
	const date = new Date(sqliteUtc.replace(' ', 'T') + 'Z');
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York',
		month: '2-digit',
		day: '2-digit',
		year: '2-digit',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	}).formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
	return `${get('month')}/${get('day')}/${get('year')} ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
}

export function initialsFor(name: string): string {
	return name
		.split(' ')
		.map((p) => p[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();
}
