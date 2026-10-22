import { useState } from 'react';
import type { TeamMember } from '../../team/types';
import type { StatName } from '../../pokemon/types';
import { useAnalysis } from '../../team/hooks/useAnalysis';
import { action, control } from '../../team/components/TeamEditor';
import type { DamageMember, DamageResult } from '../types';

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
const moves = [
  ['Tackle', '몸통박치기'], ['Body Slam', '누르기'], ['Thunderbolt', '10만볼트'],
  ['Flamethrower', '화염방사'], ['Surf', '파도타기'], ['Ice Beam', '냉동빔'],
  ['Psychic', '사이코키네시스'], ['Shadow Ball', '섀도볼'],
  ['Energy Ball', '에너지볼'], ['Dragon Claw', '드래곤클로'],
  ['Crunch', '깨물어부수기'], ['Earthquake', '지진'],
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
  return <fieldset className="min-w-0 rounded-[8px] border border-[#344253] p-3">
    <legend className="px-1 text-[12px]">{title}</legend>
    <label className="flex flex-col gap-1 text-[11px]">{title} 포켓몬
      <select className={control} value={value.pokemonId} onChange={(e) => onChange({ ...value, pokemonId: e.target.value })}>
        <option value="">팀에서 선택</option>
        {members.map((m) => <option key={m.pokemonId} value={m.pokemonId}>{label(m.pokemonId)}</option>)}
      </select>
    </label>
    <label className="mt-3 flex flex-col gap-1 text-[11px]">{title} 성향
      <select className={control} value={value.alignment} onChange={(e) => onChange({ ...value, alignment: e.target.value })}>
        {alignments.map((name) => <option key={name}>{name}</option>)}
      </select>
    </label>
    <p className="mt-3 text-[11px]">능력 포인트 · 합계 {total} / 66</p>
    <div className="mt-2 grid grid-cols-2 gap-2">
      {stats.map(([key, name]) => <label key={key} className="flex min-w-0 flex-col gap-1 text-[10px]">{title} {name}
        <input className={control} type="number" min={0} max={32} step={1}
          value={Number.isNaN(value.statPoints[key]) ? '' : value.statPoints[key]}
          onChange={(e) => onChange({ ...value, statPoints: { ...value.statPoints, [key]: e.target.valueAsNumber } })} />
      </label>)}
    </div>
    {!validPoints(value) && <p role="alert" className="mt-2 text-[11px] text-[#d3b97c]">각 포인트는 정수 0–32, 합계는 66 이하로 입력하세요.</p>}
  </fieldset>;
}

export default function DamagePanel({ own, opponent, label, sessionReady }: {
  own: TeamMember[]; opponent: TeamMember[]; label: (id: string) => string; sessionReady: boolean;
}) {
  const [attacker, setAttacker] = useState(initial);
  const [defender, setDefender] = useState(initial);
  const [move, setMove] = useState('Thunderbolt');
  const [neutral, setNeutral] = useState(false);
  const [currentHp, setCurrentHp] = useState('');
  const hpValid = currentHp === '' || (Number.isSafeInteger(Number(currentHp)) && Number(currentHp) >= 1);
  // Removed team members must invalidate a submitted scenario immediately.
  const payload = {
    attacker: { ...attacker, pokemonId: own.some((m) => m.pokemonId === attacker.pokemonId) ? attacker.pokemonId : '' },
    defender: { ...defender, pokemonId: opponent.some((m) => m.pokemonId === defender.pokemonId) ? defender.pokemonId : '' },
    move, neutralConditions: neutral,
    defenderCurrentHp: currentHp === '' ? null : Number(currentHp),
  };
  const result = useAnalysis<DamageResult>('/battle/damage', payload);
  const valid = sessionReady && payload.attacker.pokemonId && payload.defender.pokemonId
    && neutral && hpValid && validPoints(attacker) && validPoints(defender);
  const damage = result.data?.calculation.damage;
  return <section aria-label="참조 데미지 계산" className="mt-4 rounded-[12px] border border-[#2b3441] bg-[#151c26] p-4">
    <h2 className="text-[14px] font-semibold">참조 데미지 계산</h2>
    <p className="my-3 text-[11px] leading-[1.9] text-[#a3b2c3]">
      내 팀에서 공격자, 상대 팀에서 방어자를 선택하세요. 레벨 50·싱글의 참조 시나리오이며 실제 게임 피해·참가 적격성·기술 습득 여부는 미검증입니다.
      초기값은 포인트 0·Hardy입니다. 아래 입력은 계산 전용이며 저장된 팀의 기술·HP·특성·도구를 반영하지 않습니다.
    </p>
    <div className="grid grid-cols-2 gap-3 max-phone:grid-cols-1">
      <MemberInput title="공격자" members={own} value={payload.attacker} onChange={setAttacker} label={label} />
      <MemberInput title="방어자" members={opponent} value={payload.defender} onChange={setDefender} label={label} />
    </div>
    <label className="my-3 flex flex-col gap-1 text-[11px]">계산 기술
      <select className={control} value={move} onChange={(e) => setMove(e.target.value)}>
        {moves.map(([id, name]) => <option value={id} key={id}>{name} · {id}</option>)}
      </select>
    </label>
    <label className="my-3 flex flex-col gap-1 text-[11px]">방어자 남은 HP (실수치)
      <input aria-label="방어자 남은 HP (실수치)" className={control} type="number" min={1} step={1} value={currentHp}
        placeholder="비우면 최대 HP 가정" onChange={(e) => setCurrentHp(e.target.value)} />
      <span className="text-[#8295a8]">퍼센트가 아닌 정수 HP 입력 · 비우면 계산된 최대 HP 가정 · 최대 HP 초과 시 서버에서 거부</span>
    </label>
    {!hpValid && <p role="alert" className="text-[11px] text-[#d3b97c]">남은 HP는 1 이상의 정수로 입력하세요.</p>}
    <label className="my-3 flex items-start gap-2 text-[11px] leading-[1.9] text-[#c4b38f]">
      <input type="checkbox" className="mt-1" checked={neutral} onChange={(e) => setNeutral(e.target.checked)} />
      특성·도구·상태·날씨·필드·능력치 변화 없이, 명중·단일 타격·비급소 조건으로 계산
    </label>
    <button className={action} disabled={!valid || result.busy} onClick={result.run}>참조 피해 계산</button>
    {!sessionReady && <p className="mt-2 text-[11px]">세션 연결 후 계산할 수 있습니다.</p>}
    {result.busy && <p role="status" className="mt-3 text-[11px] text-accent">참조 피해 계산 중…</p>}
    {result.error && <p role="alert" className="mt-3 text-[11px] text-[#d3b97c]">{result.error.message} 입력 또는 계산기 연결을 확인하고 다시 시도하세요.</p>}
    {damage && result.data && <div className="mt-4 border-t border-[#344253] pt-3 text-[11px] leading-[1.9]">
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
        {result.data.citations.map((c) => <p key={c.sourceUrl}><a className="text-accent underline" href={c.sourceUrl.startsWith('https://') ? c.sourceUrl : undefined} target="_blank" rel="noreferrer">{c.title}</a> · {c.version}</p>)}
      </details>
    </div>}
  </section>;
}
