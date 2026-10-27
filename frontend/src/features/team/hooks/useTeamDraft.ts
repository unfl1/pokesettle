import { useEffect, useRef, useState } from 'react';
import type { TeamMember } from '../types';

export interface TeamDraftState {
  own: TeamMember[];
  opponent: TeamMember[];
  name: string;
  selectedId: string;
  notice: string;
  tab: 'team' | 'battle';
  ownActive: number;
  opponentActive: number;
  attackTypes: string[];
  megaUsed: string;
  megaTargetId: string;
  switchBlocked: string;
}

export function useTeamDraft(initial?: TeamDraftState) {
  const [own, setOwn] = useState<TeamMember[]>(initial?.own ?? []),
    [opponent, setOpponent] = useState<TeamMember[]>(initial?.opponent ?? []);
  const [name, setName] = useState(initial?.name ?? '내 팀'),
    [selectedId, setSelectedId] = useState(initial?.selectedId ?? '');
  const [notice, setNotice] = useState(initial?.notice ?? ''),
    [tab, setTab] = useState<'team' | 'battle'>(initial?.tab ?? 'team');
  const [ownActive, setOwnActive] = useState(initial?.ownActive ?? 0),
    [opponentActive, setOpponentActive] = useState(initial?.opponentActive ?? 0);
  const [attackTypes, setAttackTypes] = useState<string[]>(initial?.attackTypes ?? []),
    [megaUsed, setMegaUsed] = useState(initial?.megaUsed ?? 'unknown'),
    [megaTargetId, setMegaTargetId] = useState(initial?.megaTargetId ?? ''),
    [switchBlocked, setSwitchBlocked] = useState(initial?.switchBlocked ?? 'unknown');
  const activeId = own[Math.min(ownActive, Math.max(0, own.length - 1))]?.pokemonId;
  const previousActiveId = useRef(activeId);
  useEffect(() => {
    if (previousActiveId.current !== activeId) setMegaTargetId('');
    previousActiveId.current = activeId;
  }, [activeId]);
  return { own, setOwn, opponent, setOpponent, name, setName, selectedId, setSelectedId,
    notice, setNotice, tab, setTab, ownActive, setOwnActive, opponentActive, setOpponentActive,
    attackTypes, setAttackTypes, megaUsed, setMegaUsed, megaTargetId, setMegaTargetId,
    switchBlocked, setSwitchBlocked };
}
