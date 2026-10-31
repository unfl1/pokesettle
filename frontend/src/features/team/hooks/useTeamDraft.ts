import { useI18n } from '../../../i18n/I18nProvider';
import { useLayoutEffect, useRef, useState } from 'react';
import type { TeamMember } from '../types';

export interface TeamDraftState {
  own: TeamMember[];
  opponent: TeamMember[];
  name: string;
  selectedId: string;
  notice: string;
  tab: 'team' | 'battle' | 'damage';
  ownActive: number;
  opponentActive: number;
  attackTypes: string[];
  megaUsed: string;
  megaTargetId: string;
  switchBlocked: string;
}

export function useTeamDraft(initial?: TeamDraftState) {
  const { t } = useI18n();
  const [own, setOwn] = useState<TeamMember[]>(initial?.own ?? []),
    [opponent, setOpponent] = useState<TeamMember[]>(initial?.opponent ?? []);
  const [name, setName] = useState(initial?.name ?? t('내 팀')),
    [selectedId, setSelectedId] = useState(initial?.selectedId ?? '');
  const [notice, setNotice] = useState(initial?.notice ?? ''),
    [tab, setTab] = useState<'team' | 'battle' | 'damage'>(initial?.tab ?? 'team');
  const [ownActive, setOwnActive] = useState(initial?.ownActive ?? 0),
    [opponentActive, setOpponentActive] = useState(initial?.opponentActive ?? 0);
  const [attackTypes, setAttackTypes] = useState<string[]>(initial?.attackTypes ?? []),
    [megaUsed, setMegaUsed] = useState(initial?.megaUsed ?? 'unknown'),
    [megaTargetId, setMegaTargetId] = useState(initial?.megaTargetId ?? ''),
    [switchBlocked, setSwitchBlocked] = useState(initial?.switchBlocked ?? 'unknown');
  const activeId = own[Math.min(ownActive, Math.max(0, own.length - 1))]?.pokemonId;
  const previousActiveId = useRef(activeId);
  useLayoutEffect(() => {
    if (previousActiveId.current !== activeId) setMegaTargetId('');
    previousActiveId.current = activeId;
  }, [activeId]);
  function restore(saved: TeamDraftState) {
    previousActiveId.current = saved.own[Math.min(saved.ownActive, Math.max(0, saved.own.length - 1))]?.pokemonId;
    setOwn(saved.own); setOpponent(saved.opponent); setName(saved.name);
    setSelectedId(saved.selectedId); setNotice(saved.notice); setTab(saved.tab);
    setOwnActive(saved.ownActive); setOpponentActive(saved.opponentActive);
    setAttackTypes(saved.attackTypes); setMegaUsed(saved.megaUsed);
    setMegaTargetId(saved.megaTargetId); setSwitchBlocked(saved.switchBlocked);
  }
  return { restore, own, setOwn, opponent, setOpponent, name, setName, selectedId, setSelectedId,
    notice, setNotice, tab, setTab, ownActive, setOwnActive, opponentActive, setOpponentActive,
    attackTypes, setAttackTypes, megaUsed, setMegaUsed, megaTargetId, setMegaTargetId,
    switchBlocked, setSwitchBlocked };
}
