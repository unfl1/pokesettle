import type { TeamDraftState } from '../features/team/hooks/useTeamDraft';
import type { TeamMember } from '../features/team/types';

const key = 'poketact-navigation-draft';
export type NavigationDraft = { draft: string; team: TeamDraftState };

function isMembers(value: unknown): value is TeamMember[] {
  return Array.isArray(value) && value.length <= 6 && value.every(member =>
    member && typeof member.pokemonId === 'string' &&
    (member.hpPercent === null || (Number.isFinite(member.hpPercent) && member.hpPercent >= 0 && member.hpPercent <= 100)) &&
    (member.item === null || typeof member.item === 'string') &&
    (member.ability === null || typeof member.ability === 'string') &&
    Array.isArray(member.moves) && member.moves.length <= 4 && member.moves.every((move: Record<string, unknown>) =>
      move && typeof move.name === 'string' && typeof move.type === 'string' && ['physical', 'special', 'status'].includes(String(move.category)))
  );
}

export function takeNavigationDraft(): NavigationDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!raw || navigation?.type === 'reload') return null;
    const value = JSON.parse(raw);
    const team = value?.team;
    if (!value || typeof value.draft !== 'string' || value.draft.length > 2000 ||
      !Number.isFinite(value.savedAt) || Date.now() - value.savedAt > 30 * 60 * 1000 ||
      !team || !isMembers(team.own) || !isMembers(team.opponent) ||
      !['name', 'selectedId', 'notice', 'megaUsed', 'megaTargetId', 'switchBlocked'].every(field => typeof team[field] === 'string') ||
      !['team', 'battle', 'damage'].includes(team.tab) ||
      ![team.ownActive, team.opponentActive].every(index => Number.isInteger(index) && index >= 0 && index < 6) ||
      !Array.isArray(team.attackTypes) || !team.attackTypes.every((type: unknown) => typeof type === 'string')) return null;
    return { draft: value.draft, team };
  } catch {
    return null;
  }
}

export function saveNavigationDraft(value: NavigationDraft) {
  try {
    // One-document handoff only: never store conversation messages or model answers.
    sessionStorage.setItem(key, JSON.stringify({ ...value, savedAt: Date.now() }));
  } catch {
    // Browsing still works when tab storage is unavailable.
  }
}
