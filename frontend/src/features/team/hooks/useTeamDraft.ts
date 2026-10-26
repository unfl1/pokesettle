import { useEffect, useState } from 'react';
import type { TeamMember } from '../types';

export function useTeamDraft() {
  const [own, setOwn] = useState<TeamMember[]>([]),
    [opponent, setOpponent] = useState<TeamMember[]>([]);
  const [name, setName] = useState('내 팀'),
    [selectedId, setSelectedId] = useState('');
  const [notice, setNotice] = useState(''),
    [tab, setTab] = useState<'team' | 'battle'>('team');
  const [ownActive, setOwnActive] = useState(0),
    [opponentActive, setOpponentActive] = useState(0);
  const [attackTypes, setAttackTypes] = useState<string[]>([]),
    [megaUsed, setMegaUsed] = useState('unknown'),
    [megaTargetId, setMegaTargetId] = useState(''),
    [switchBlocked, setSwitchBlocked] = useState('unknown');
  const activeId = own[Math.min(ownActive, Math.max(0, own.length - 1))]?.pokemonId;
  useEffect(() => setMegaTargetId(''), [activeId]);
  return { own, setOwn, opponent, setOpponent, name, setName, selectedId, setSelectedId,
    notice, setNotice, tab, setTab, ownActive, setOwnActive, opponentActive, setOpponentActive,
    attackTypes, setAttackTypes, megaUsed, setMegaUsed, megaTargetId, setMegaTargetId,
    switchBlocked, setSwitchBlocked };
}
