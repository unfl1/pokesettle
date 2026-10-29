import { useI18n } from '../../../i18n/I18nProvider';
import { useTypeLabels } from '../../pokemon/typeLabels';
import PokemonImage from '../../pokemon/components/PokemonImage';
import type { PokemonSummary } from '../../pokemon/types';
import type { SelectionPlan } from '../types';

export default function SelectionRecommendation({ plan, label, pokemon, onApply, onAsk }: {
  plan: SelectionPlan;
  pokemon: PokemonSummary[];
  label: (id: string) => string;
  onApply: () => void;
  onAsk: () => void;
}) {
  const typeLabels = useTypeLabels();
  const { t: translate } = useI18n();
  const byId = new Map(pokemon.map(p => [p.pokemonId, p]));
  const names = (ids: string[]) => ids.map(label).join(' · ');
  const typeName = (type: string | null) => type ? typeLabels[type] ?? type : translate("공격");
  return <section aria-label={translate("추천 선출과 운영")} className="mt-5 rounded-xl border border-accent/40 bg-accent/5 p-4">
    <h2 className="text-base font-semibold">{translate("추천 3마리와 선봉")}</h2>
    <p className="mt-2 font-medium text-accent">{names(plan.pokemonIds)}</p>
    <p className="mt-2 text-[14px]">{translate("선봉 추천:")} <strong>{label(plan.leadId)}</strong></p>
    <p className="mt-1 text-[14px] text-muted">{plan.leadReason}</p>
    <div className="mt-4 grid gap-3 tablet:grid-cols-3">
      {plan.members.map(m => <div key={m.pokemonId} className="rounded-lg border border-line bg-surface p-3 text-[14px] leading-6">
        <div className="mb-2 flex items-center gap-2">
          {byId.get(m.pokemonId) && <PokemonImage pokemon={byId.get(m.pokemonId)!} size="small" />}
          <h3 className="font-semibold">{label(m.pokemonId)}</h3>
          {m.pokemonId === plan.leadId && <span className="ml-auto rounded-full bg-accent/8 px-2 text-[12px] text-accent">{translate("선봉")}</span>}
        </div>
        <p>{translate("약점 공략:")} {m.attackTargets.length ? names(m.attackTargets) : translate("해당 상대 없음")}</p>
        <p>{translate("반감 대응:")} {m.resistTargets.length ? names(m.resistTargets) : translate("해당 상대 없음")}</p>
        <p className="text-muted">{m.attackAssumed ? translate("공격 기술 미입력: 자기 타입 공격 가정") : translate("직접 입력한 공격 기술 타입 기준")}</p>
      </div>)}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button className="rounded-md border border-accent/40 px-3 py-2 text-[14px] text-accent" onClick={onApply}>{translate("추천 선봉으로 전투 비교")}</button>
      <button className="rounded-md border border-line px-3 py-2 text-[14px]" onClick={onAsk}>{translate("이 선출의 전략 근거 질문하기")}</button>
    </div>
    <details className="mt-4 rounded-lg border border-line bg-surface p-3"><summary className="cursor-pointer text-[14px] font-semibold">{translate("상대 선봉별 시작 방향")}</summary>
    <p className="mt-1 text-[14px] text-muted">{translate("상대 선봉을 예측한 순서가 아닌, 상대 6마리가 각각 먼저 나온 경우의 비교입니다.")}</p>
    <div className="mt-3 grid gap-3 tablet:grid-cols-2">
      {plan.matchups.map(m => <article key={m.opponentId} className="rounded-lg border border-line bg-surface p-3 text-[14px] leading-6">
        <h4 className="font-semibold">{translate("상대")} {label(m.opponentId)}</h4>
        <p className="text-accent">{m.leadAction === 'attack'
          ? translate('{name}의 {type} 공격을 우선 검토하세요 ({multiplier}배).', { name: label(plan.leadId), type: typeName(m.leadAttackType), multiplier: m.leadAttackMultiplier ?? '—' })
          : m.leadAction === 'switch' && m.pivotId
            ? translate('교체를 우선 추천합니다: {name}', { name: label(m.pivotId) })
            : translate("무리한 공격보다 보유 기술과 교체 경로를 먼저 확인하세요.")}</p>
        {m.attackerId && <p>{translate("공격 후보:")} {label(m.attackerId)} · {typeName(m.attackType)} {m.attackMultiplier}{translate("배")}{m.attackAssumed ? translate("(기술 보유 가정)") : ''}</p>}
        <p>{translate("교체 후보:")} {m.pivotId ? translate('{name} · 상대 비교 공격 최대 {multiplier}배', { name: label(m.pivotId), multiplier: m.pivotMultiplier ?? '—' }) : translate("선봉 외에 비교 공격이 약점이 아닌 멤버 없음")}</p>
        <p className="text-muted">{m.incomingAssumed ? translate("상대 자기 타입 공격 가정") : translate("상대 입력 공격 기준")}: {m.incomingTypes.length ? m.incomingTypes.map(typeName).join(' · ') : translate("공격 기술 없음")}
          {m.leadIncomingMultiplier !== null && ` ${translate('· 내 선봉에 최대 {multiplier}배', { multiplier: m.leadIncomingMultiplier })}`}</p>
      </article>)}
    </div>
    </details>
    <h3 className="mt-4 text-[14px] font-semibold">{translate("조합의 주의점")}</h3>
    <ul className="mt-2 list-disc pl-4 text-[14px] leading-6 text-muted">
      {plan.uncoveredOpponentIds.length > 0 && <li>{translate("약점 공략이 없는 상대:")} {names(plan.uncoveredOpponentIds)}</li>}
      {plan.noResistOpponentIds.length > 0 && <li>{translate("비교 공격을 모두 반감할 멤버가 없는 상대:")} {names(plan.noResistOpponentIds)}</li>}
      <li>{translate("공격·교체 방향은 타입 기준입니다. 기술 보유, 선공과 생존 여부에 따라 선택이 달라집니다.")}</li>
    </ul>
  </section>;
}
