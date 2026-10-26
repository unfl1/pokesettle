import { typeLabels } from '../../pokemon/typeLabels';
import type { SelectionPlan } from '../types';

export default function SelectionRecommendation({ plan, label, onApply, onAsk }: {
  plan: SelectionPlan;
  label: (id: string) => string;
  onApply: () => void;
  onAsk: () => void;
}) {
  const names = (ids: string[]) => ids.map(label).join(' · ');
  const typeName = (type: string | null) => type ? typeLabels[type] ?? type : '공격';
  return <section aria-label="추천 선출과 운영" className="mt-5 rounded-xl border border-accent/40 bg-accent/5 p-4">
    <h2 className="text-base font-semibold">추천 3마리와 선봉</h2>
    <p className="mt-2 font-medium text-accent">{names(plan.pokemonIds)}</p>
    <p className="mt-2 text-[14px]">선봉 추천: <strong>{label(plan.leadId)}</strong></p>
    <p className="mt-1 text-[14px] text-muted">{plan.leadReason}</p>
    <div className="mt-4 grid gap-3 tablet:grid-cols-3">
      {plan.members.map(m => <div key={m.pokemonId} className="rounded-lg border border-line bg-surface p-3 text-[14px] leading-6">
        <h3 className="font-semibold">{label(m.pokemonId)}{m.pokemonId === plan.leadId ? ' · 선봉' : ''}</h3>
        <p>약점 공략: {m.attackTargets.length ? names(m.attackTargets) : '해당 상대 없음'}</p>
        <p>반감 대응: {m.resistTargets.length ? names(m.resistTargets) : '해당 상대 없음'}</p>
        <p className="text-muted">{m.attackAssumed ? '공격 기술 미입력: 자기 타입 공격 가정' : '직접 입력한 공격 기술 타입 기준'}</p>
      </div>)}
    </div>
    <h3 className="mt-5 text-[14px] font-semibold">상대 선봉별 시작 방향</h3>
    <p className="mt-1 text-[14px] text-muted">상대 선봉을 예측한 순서가 아닌, 상대 6마리가 각각 먼저 나온 경우의 비교입니다.</p>
    <div className="mt-3 grid gap-3 tablet:grid-cols-2">
      {plan.matchups.map(m => <article key={m.opponentId} className="rounded-lg border border-line bg-surface p-3 text-[14px] leading-6">
        <h4 className="font-semibold">상대 {label(m.opponentId)}</h4>
        <p className="text-accent">{m.leadAction === 'attack'
          ? `${label(plan.leadId)}의 ${typeName(m.leadAttackType)} 공격을 우선 검토하세요 (${m.leadAttackMultiplier}배).`
          : m.leadAction === 'switch' && m.pivotId
            ? `교체를 우선 추천합니다: ${label(m.pivotId)}`
            : '무리한 공격보다 보유 기술과 교체 경로를 먼저 확인하세요.'}</p>
        {m.attackerId && <p>공격 후보: {label(m.attackerId)} · {typeName(m.attackType)} {m.attackMultiplier}배{m.attackAssumed ? ' (기술 보유 가정)' : ''}</p>}
        <p>교체 후보: {m.pivotId ? `${label(m.pivotId)} · 상대 비교 공격 최대 ${m.pivotMultiplier}배` : '선봉 외에 비교 공격이 약점이 아닌 멤버 없음'}</p>
        <p className="text-muted">{m.incomingAssumed ? '상대 자기 타입 공격 가정' : '상대 입력 공격 기준'}: {m.incomingTypes.length ? m.incomingTypes.map(typeName).join(' · ') : '공격 기술 없음'}
          {m.leadIncomingMultiplier !== null && ` · 내 선봉에 최대 ${m.leadIncomingMultiplier}배`}</p>
      </article>)}
    </div>
    <h3 className="mt-4 text-[14px] font-semibold">조합의 주의점</h3>
    <ul className="mt-2 list-disc pl-4 text-[14px] leading-6 text-muted">
      {plan.uncoveredOpponentIds.length > 0 && <li>약점 공략이 없는 상대: {names(plan.uncoveredOpponentIds)}</li>}
      {plan.noResistOpponentIds.length > 0 && <li>비교 공격을 모두 반감할 멤버가 없는 상대: {names(plan.noResistOpponentIds)}</li>}
      <li>공격·교체 방향은 타입 기준입니다. 기술 보유, 선공과 생존 여부에 따라 선택이 달라집니다.</li>
    </ul>
    <div className="mt-4 flex flex-wrap gap-2">
      <button className="rounded-md border border-accent/40 px-3 py-2 text-[14px] text-accent" onClick={onApply}>추천 선봉으로 전투 비교</button>
      <button className="rounded-md border border-line px-3 py-2 text-[14px]" onClick={onAsk}>이 선출의 전략 근거 질문하기</button>
    </div>
  </section>;
}
