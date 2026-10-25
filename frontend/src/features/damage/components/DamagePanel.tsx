import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '../../../lib/apiClient';
import { typeLabels } from '../../pokemon/typeLabels';
import { TypeBadge } from '../../pokemon/components/TypeBadge';
import type { TeamMember } from '../../team/types';
import type { StatName } from '../../pokemon/types';
import { useAnalysis } from '../../team/hooks/useAnalysis';
import { action, control } from '../../team/components/TeamEditor';
import type { DamageMember, DamageResult, DamageMoveOptions } from '../types';

const stats: [StatName, string][] = [
  ['hp', 'HP'], ['attack', '공격'], ['defense', '방어'],
  ['spAttack', '특수공격'], ['spDefense', '특수방어'], ['speed', '스피드'],
];
const alignments = [
  'Adamant', 'Bashful', 'Bold', 'Brave', 'Calm', 'Careful', 'Docile',
  'Gentle', 'Hardy', 'Hasty', 'Impish', 'Jolly', 'Lax', 'Lonely', 'Mild',
  'Modest', 'Naive', 'Naughty', 'Quiet', 'Quirky', 'Rash', 'Relaxed',
  'Sassy', 'Serious', 'Timid',
];
const initial = (): DamageMember => ({
  pokemonId: '', alignment: 'Hardy',
  statPoints: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
});
const validPoints = (member: DamageMember) =>
  Object.values(member.statPoints).every((n) => Number.isInteger(n) && n >= 0 && n <= 32)
  && Object.values(member.statPoints).reduce((a, b) => a + b, 0) <= 66;

function MemberInput({ title, members, value, onChange, label }: {
  title: string; members: TeamMember[]; value: DamageMember;
  onChange: (member: DamageMember) => void; label: (id: string) => string;
}) {
  const total = Object.values(value.statPoints).reduce((a, b) => a + b, 0);
  return <fieldset className="min-w-0 rounded-[8px] border border-line p-3">
    <legend className="px-1 text-[13px]">{title}</legend>
    <label className="flex flex-col gap-1 text-[12px]">{title} 포켓몬
      <select className={control} value={value.pokemonId} onChange={(e) => onChange({ ...value, pokemonId: e.target.value })}>
        <option value="">팀에서 선택</option>
        {members.map((m) => <option key={m.pokemonId} value={m.pokemonId}>{label(m.pokemonId)}</option>)}
      </select>
    </label>
    <label className="mt-3 flex flex-col gap-1 text-[12px]">{title} 성향
      <select className={control} value={value.alignment} onChange={(e) => onChange({ ...value, alignment: e.target.value })}>
        {alignments.map((name) => <option key={name}>{name}</option>)}
      </select>
    </label>
    <p className="mt-3 text-[12px]">Champions 능력 포인트 (SP) · 합계 {total} / 66</p>
    <p className="mt-1 text-[11px] leading-5 text-muted">Champions 육성 기준: 한 능력치 최대 32, 전체 66 포인트. 기존 본가 노력치(EV)의 252·510을 입력하는 칸이 아닙니다. 예: 32 / 32 / 2 배분.</p>
    <div className="mt-2 grid grid-cols-2 gap-2">
      {stats.map(([key, name]) => <label key={key} className="flex min-w-0 flex-col gap-1 text-[11px]">{title} {name}
        <input className={control} type="number" min={0} max={32} step={1}
          value={Number.isNaN(value.statPoints[key]) ? '' : value.statPoints[key]}
          onChange={(e) => onChange({ ...value, statPoints: { ...value.statPoints, [key]: e.target.valueAsNumber } })} />
      </label>)}
    </div>
    {!validPoints(value) && <p role="alert" className="mt-2 text-[12px] text-warning">각 포인트는 정수 0–32, 합계는 66 이하로 입력하세요.</p>}
  </fieldset>;
}

export default function DamagePanel({ own, opponent, label, sessionReady }: {
  own: TeamMember[]; opponent: TeamMember[]; label: (id: string) => string; sessionReady: boolean;
}) {
  const [attacker, setAttacker] = useState(initial);
  const [defender, setDefender] = useState(initial);
  const [move, setMove] = useState('');
  const [moveType, setMoveType] = useState('all');
  const [moveMethod, setMoveMethod] = useState('all');
  const [moveSearch, setMoveSearch] = useState('');
  const activeAttacker = own.some(m => m.pokemonId === attacker.pokemonId) ? attacker.pokemonId : '';
  const options = useQuery({
    queryKey: ['damage-moves', activeAttacker],
    queryFn: () => request<DamageMoveOptions>(`/battle/damage/moves/${encodeURIComponent(activeAttacker)}`),
    enabled: Boolean(activeAttacker) && sessionReady,
    staleTime: 60000,
  });
  const filteredMoves = options.data?.items.filter(m =>
    (moveType === 'all' || m.type === moveType) &&
    (moveMethod === 'all' || m.methods.includes(moveMethod)) &&
    `${m.nameKo ?? ''} ${m.name}`.toLowerCase().includes(moveSearch.toLowerCase())
  ) ?? [];
  const selectedMove = filteredMoves.find(m => m.name === move && m.supported);
  const [neutral, setNeutral] = useState(false);
  const [currentHp, setCurrentHp] = useState('');
  const hpValid = currentHp === '' || (Number.isSafeInteger(Number(currentHp)) && Number(currentHp) >= 1);
  // Removed team members must invalidate a submitted scenario immediately.
  const payload = {
    attacker: { ...attacker, pokemonId: own.some((m) => m.pokemonId === attacker.pokemonId) ? attacker.pokemonId : '' },
    defender: { ...defender, pokemonId: opponent.some((m) => m.pokemonId === defender.pokemonId) ? defender.pokemonId : '' },
    move: selectedMove?.name ?? '', neutralConditions: neutral,
    defenderCurrentHp: currentHp === '' ? null : Number(currentHp),
  };
  const result = useAnalysis<DamageResult>('/battle/damage', payload);
  const valid = sessionReady && payload.attacker.pokemonId && payload.defender.pokemonId
    && Boolean(selectedMove) && !options.isFetching && neutral && hpValid && validPoints(attacker) && validPoints(defender);
  const damage = result.data?.calculation.damage;
  return <section aria-label="참조 데미지 계산" className="mt-4 rounded-[12px] border border-line bg-surface p-4">
    <h2 className="text-[14px] font-semibold">참조 데미지 계산</h2>
    <p className="my-3 text-[12px] leading-[1.9] text-muted">
      내 팀에서 공격자, 상대 팀에서 방어자를 선택하세요. 레벨 50·싱글의 참조 시나리오이며 실제 게임 피해·참가 적격성·기술 습득 여부는 미검증입니다.
      초기값은 포인트 0·Hardy입니다. 아래 입력은 계산 전용이며 저장된 팀의 기술·HP·특성·도구를 반영하지 않습니다.
    </p>
    <div className="grid grid-cols-2 gap-3 max-phone:grid-cols-1">
      <MemberInput title="공격자" members={own} value={payload.attacker} onChange={value => {
        if (value.pokemonId !== attacker.pokemonId) {
          setMove(''); setMoveType('all'); setMoveMethod('all'); setMoveSearch('');
        }
        setAttacker(value);
      }} label={label} />
      <MemberInput title="방어자" members={opponent} value={payload.defender} onChange={setDefender} label={label} />
    </div>
    <div className="my-4 rounded-lg border border-line p-3">
      <h3 className="text-sm font-medium">공격자가 배울 수 있는 기술</h3>
      {!activeAttacker && <p className="mt-2 text-xs text-muted">공격자 포켓몬을 먼저 선택하세요.</p>}
      {options.isFetching && <p role="status" className="mt-2 text-xs">습득 기술 확인 중…</p>}
      {options.error && <p role="alert" className="mt-2 text-xs text-warning">{options.error.message} <button className={action} onClick={() => void options.refetch()}>기술 목록 다시 불러오기</button></p>}
      {options.data && <>
        <p className="mt-2 text-xs text-muted">원본 게임: {options.data.versionGroup ?? '자료 없음'} · Champions 습득 가능 여부 미확인</p>
        <p className="mt-1 text-xs text-muted">수집 기술 {options.data.items.length}개 중 참조 계산 지원 {options.data.items.filter(m => m.supported).length}개 · 회색 기술은 지원하지 않으며 이유를 함께 표시합니다.</p>
        {!options.data.versionGroup && <p role="alert" className="mt-2 text-xs text-warning">이 폼의 습득 기술 자료가 없어 계산할 수 없습니다.</p>}
      </>}
      <div className="mt-3 grid gap-2 tablet:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">기술 이름 검색<input className={control} value={moveSearch} onChange={e => setMoveSearch(e.target.value)} placeholder="한국어·원본 이름" /></label>
        <label className="flex flex-col gap-1 text-xs">계산 기술 타입<select aria-label="계산 기술 타입" className={control} value={moveType} onChange={e => setMoveType(e.target.value)}><option value="all">전체 타입</option>{[...new Set(options.data?.items.map(m => m.type).filter((t): t is string => Boolean(t)))].map(t => <option key={t} value={t}>{typeLabels[t] ?? t}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs">계산 기술 습득 방법<select aria-label="계산 기술 습득 방법" className={control} value={moveMethod} onChange={e => setMoveMethod(e.target.value)}><option value="all">전체 방법</option><option value="machine">기술머신·비전머신</option><option value="level-up">레벨업</option><option value="egg">알 기술</option><option value="tutor">기술 가르침</option><option value="train">트레이닝</option></select></label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-xs">계산 기술
        <select aria-label="계산 기술" className={control} value={filteredMoves.some(m => m.name === move) ? move : ''} disabled={!options.data?.items.length || options.isFetching} onChange={e => setMove(e.target.value)}>
          <option value="">기술을 선택하세요</option>
          {[...new Set(filteredMoves.map(m => m.type ?? 'unknown'))].map(t => <optgroup key={t} label={typeLabels[t] ?? '타입 미확인'}>{filteredMoves.filter(m => (m.type ?? 'unknown') === t).map(m => <option key={m.name} value={m.name} disabled={!m.supported}>{m.nameKo ?? m.name} · {m.name} · {m.supported ? `위력 ${m.power ?? '—'} / 명중 ${m.accuracy ?? '—'}` : `미지원: ${m.unsupportedReason}`}</option>)}</optgroup>)}
        </select>
      </label>
      {options.data && !filteredMoves.length && <p className="mt-2 text-xs text-muted">조건에 맞는 기술이 없습니다.</p>}
      {selectedMove && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><TypeBadge type={selectedMove.type ?? 'unknown'} /><span>{selectedMove.nameKo ?? selectedMove.name} · {selectedMove.category === 'physical' ? '물리' : '특수'} · 위력 {selectedMove.power ?? '—'} · 명중 {selectedMove.accuracy ?? '—'}</span></div>}
    </div>
    <label className="my-3 flex flex-col gap-1 text-[12px]">방어자 남은 HP (실수치)
      <input aria-label="방어자 남은 HP (실수치)" className={control} type="number" min={1} step={1} value={currentHp}
        placeholder="비우면 최대 HP 가정" onChange={(e) => setCurrentHp(e.target.value)} />
      <span className="text-muted">퍼센트가 아닌 정수 HP 입력 · 비우면 계산된 최대 HP 가정 · 최대 HP 초과 시 서버에서 거부</span>
    </label>
    {!hpValid && <p role="alert" className="text-[12px] text-warning">남은 HP는 1 이상의 정수로 입력하세요.</p>}
    <label className="my-3 flex items-start gap-2 text-[12px] leading-[1.9] text-warning">
      <input type="checkbox" className="mt-1" checked={neutral} onChange={(e) => setNeutral(e.target.checked)} />
      특성·도구·상태·날씨·필드·능력치 변화 없이, 명중·단일 타격·비급소 조건으로 계산
    </label>
    <button className={action} disabled={!valid || result.busy} onClick={result.run}>참조 피해 계산</button>
    {!sessionReady && <p className="mt-2 text-[12px]">세션 연결 후 계산할 수 있습니다.</p>}
    {result.busy && <p role="status" className="mt-3 text-[12px] text-accent">참조 피해 계산 중…</p>}
    {result.error && <p role="alert" className="mt-3 text-[12px] text-warning">{result.error.message} 입력 또는 계산기 연결을 확인하고 다시 시도하세요.</p>}
    {damage && result.data && <div className="mt-4 border-t border-line pt-3 text-[12px] leading-[1.9]">
      <h3 className="text-[14px] text-accent">참조 피해 범위: {damage.minimum}–{damage.maximum} HP</h3>
      <p>방어자 최대 HP: {damage.defenderStats.hp} · {damage.move.name} · 위력 {damage.move.power}</p>
      {result.data.calculation.conditionalKo && <div className="my-2" aria-label="조건부 KO 결과">
        <p>단일 타격 KO 조건 충족: {result.data.calculation.conditionalKo.qualifyingRolls} / {result.data.calculation.conditionalKo.totalRolls}개 피해 후보</p>
        <p>기준 HP: {result.data.calculation.conditionalKo.currentHp} / {result.data.calculation.conditionalKo.maximumHp}
          {result.data.calculation.conditionalKo.hpBasis === 'full_hp_assumed' ? ' · 최대 HP 가정' : ' · 직접 입력'}</p>
        <p>후보 개수 비교이며 실제 KO 확률이 아닙니다. 명중·특성·도구·후속 피해는 반영하지 않습니다.</p>
      </div>}
      <p>KO 확률·승률 미제공 · 실제 게임 대조 미검증</p>
      <details className="mt-2"><summary className="cursor-pointer">피해 후보 16개·계산 가정·출처</summary>
        <p className="mt-2 wrap-anywhere">피해 후보: {damage.rolls.join(', ')}</p>
        <p>{result.data.engine.name} {result.data.engine.version} · 레벨 {result.data.engine.level}</p>
        <ul className="list-disc pl-4">{[...result.data.assumptions, ...result.data.unknowns].map((s) => <li key={s}>{s}</li>)}</ul>
        {result.data.citations.map((c) => <p key={c.sourceUrl}><a className="text-link underline" href={c.sourceUrl.startsWith('https://') ? c.sourceUrl : undefined} target="_blank" rel="noreferrer">{c.title}</a> · {c.version}</p>)}
      </details>
    </div>}
  </section>;
}
