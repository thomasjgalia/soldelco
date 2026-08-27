export interface Team {
	id: number;
	competition_id: number;
	name: string;
	score: number | null;
	placement: number | null;
}

/** Lower is better for both a golf scramble score and a cornhole placement. */
export function sortKey(team: Team): number {
	const value = team.placement ?? team.score;
	return value ?? Number.POSITIVE_INFINITY;
}

export function sortTeams<T extends Team>(teams: T[]): T[] {
	return [...teams].sort((a, b) => sortKey(a) - sortKey(b));
}

/** Every team tied for the best score/placement in a competition. */
export function winningTeams<T extends Team>(teams: T[]): T[] {
	if (teams.length === 0) return [];
	const best = Math.min(...teams.map(sortKey));
	if (!Number.isFinite(best)) return [];
	return teams.filter((t) => sortKey(t) === best);
}
