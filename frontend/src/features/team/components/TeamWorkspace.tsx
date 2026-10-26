import { useTeamDraftContext } from "../../../app/providers";
import SelectionRecommendation from './SelectionRecommendation';
import DamagePanel from '../../damage/components/DamagePanel';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { MessageSquare, ShieldAlert } from 'lucide-react';
import { pokemonApi } from '../../pokemon/api';
import { battleApi } from '../api';
import { useAnalysis } from '../hooks/useAnalysis';
import {
  type BattleResult,
  type Context,
  type SavedTeam,
  type SelectionResult,
  type TeamResult,
} from '../types';
import { typeLabels } from '../../pokemon/typeLabels';
import TeamEditor, { action, control } from './TeamEditor';

function Evidence({ result }: { result: Context }) {
  return (
    <div className="mt-4 border-t border-line pt-3 text-[14px] leading-[1.9]">
      <p className="text-accent">
        일반 타입표 계산 · Champions 적용 여부 미확인
      </p>
      <p className="mt-2 font-medium text-warning">미확인</p>
      <ul className="list-disc pl-4 text-muted">
        {result.unknowns.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <details className="mt-2 text-muted">
        <summary className="cursor-pointer">계산 가정과 출처</summary>
        <ul className="mt-2 list-disc pl-4">
          {result.assumptions.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <ul className="mt-2">
          {result.citations.map((c, i) => (
            <li key={`${c.sourceUrl}-${i}`}>
              <a
                className="text-link underline"
                href={
                  c.sourceUrl.startsWith('https://') ? c.sourceUrl : undefined
                }
                target="_blank"
                rel="noreferrer"
              >
                {c.title}
              </a>{' '}
              · {c.scope} · 수집 {c.collectedAt.slice(0, 10)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
function AnalysisState({
  busy,
  error,
}: {
  busy: boolean;
  error: Error | null;
}) {
  return (
    <>
      {busy && (
        <p role="status" className="mt-3 text-[14px] text-accent">
          타입 시나리오 비교 중…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[14px] text-warning">
          {error.message} 입력을 확인한 뒤 다시 분석해 주세요.
        </p>
      )}
    </>
  );
}

export default function TeamWorkspace({
  onAsk,
  sessionReady,
}: {
  onAsk: (question: string) => void;
  sessionReady: boolean;
}) {
  const cache = useQueryClient();
  const { own, setOwn, opponent, setOpponent, name, setName, selectedId, setSelectedId,
    notice, setNotice, tab, setTab, ownActive, setOwnActive, opponentActive, setOpponentActive,
    attackTypes, setAttackTypes, megaUsed, setMegaUsed, megaTargetId, setMegaTargetId,
    switchBlocked, setSwitchBlocked } = useTeamDraftContext();
  const activeOwn = Math.min(ownActive, Math.max(0, own.length - 1)),
    activeOpponent = Math.min(opponentActive, Math.max(0, opponent.length - 1));
  const activeId = own[activeOwn]?.pokemonId;
  const teams = useQuery({
    queryKey: ['saved-teams'],
    queryFn: battleApi.teams,
    enabled: sessionReady,
  });
  const details = useQueries({
    queries: [...new Set([...own, ...opponent].map((m) => m.pokemonId))].map(
      (id) => ({
        queryKey: ['team-pokemon', id],
        queryFn: () => pokemonApi.detail(id),
        staleTime: 60000,
      }),
    ),
  });
  const records = details.flatMap((d) => (d.data ? [d.data] : []));
  const label = (id: string) => {
    const p = records.find((p) => p.pokemonId === id);
    return p?.nameKo ?? p?.nameEn ?? id;
  };
  const active = records.find((p) => p.pokemonId === activeId);
  const megaForms = useQuery({
    queryKey: ['mega-options', active?.speciesId],
    queryFn: () => pokemonApi.pokemon(active!.nameEn.split('-mega')[0]),
    enabled: Boolean(active),
    staleTime: 60000,
  });
  const possibleMega =
    megaForms.data?.items.filter(
      (p) =>
        p.speciesId === active?.speciesId && p.formIdentifier?.includes('mega'),
    ) ?? [];
  const save = useMutation({
    mutationFn: (id?: string) => battleApi.save(name, own, id),
    onSuccess: (team) => {
      setSelectedId(team.teamId);
      setNotice('팀 저장 완료');
      void cache.invalidateQueries({ queryKey: ['saved-teams'] });
    },
  });
  const remove = useMutation({
    mutationFn: battleApi.remove,
    onSuccess: () => {
      setSelectedId('');
      setNotice('저장된 팀 삭제 완료 · 편집 중인 구성 유지');
      void cache.invalidateQueries({ queryKey: ['saved-teams'] });
    },
  });
  const payload = { own, opponent };
  const summary = useAnalysis<TeamResult>('/teams/analyze', payload);
  const selection = useAnalysis<SelectionResult>('/teams/select', payload);
  const battle = useAnalysis<BattleResult>('/battle/recommend', {
    ...payload,
    ownActive: activeOwn,
    opponentActive: activeOpponent,
    opponentAttackTypes: attackTypes,
    megaUsed: megaUsed === 'unknown' ? null : megaUsed === 'used',
    megaTargetId: megaTargetId || null,
    switchBlocked: switchBlocked === 'unknown' ? null : switchBlocked === 'yes',
  });
  const valid = sessionReady && own.length > 0 && opponent.length > 0;
  const selectSaved = (id: string, side: 'own' | 'opponent') => {
    const team = teams.data?.items.find((t: SavedTeam) => t.teamId === id);
    if (side === 'own') {
      setSelectedId(id);
      if (team) {
        setOwn(team.members);
        setName(team.name);
      }
    } else if (team) setOpponent(team.members);
    setNotice('');
  };
  return (
    <div>
      <div className="mb-5 flex items-start gap-3 rounded-[8px] border border-warning-line bg-warning-soft p-4 text-[14px] leading-[1.9] text-warning">
        <ShieldAlert size={18} />
        <p>
          현재는 일반 도감·타입표 기반 준비 시나리오입니다. 현행 Champions 참가
          적격성·기술·메가 가능 여부는 미확인입니다. 선출 점수는 비교용이며
          승률이 아닙니다. 실제 피해·KO·최선 행동을 확정하지 않습니다.
        </p>
      </div>
      {!sessionReady && (
        <p role="alert" className="mb-3 text-[14px] text-warning">
          세션 연결 후 팀 저장과 분석을 이용할 수 있습니다.
        </p>
      )}
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="준비 화면 선택"
      >
        {(['team', 'battle'] as const).map((v) => (
          <button
            key={v}
            className={`${action} aria-pressed:bg-accent/8`}
            aria-pressed={tab === v}
            onClick={() => setTab(v)}
          >
            {v === 'team' ? '팀·선출 비교' : '현재 전투 비교'}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-[14px] text-muted">
          저장한 내 팀
          <select
            className={control}
            aria-label="저장한 내 팀"
            value={selectedId}
            onChange={(e) => selectSaved(e.target.value, 'own')}
          >
            <option value="">새 팀</option>
            {teams.data?.items.map((t) => (
              <option value={t.teamId} key={t.teamId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[14px] text-muted">
          팀 이름
          <input
            className={control}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          className={action}
          disabled={!sessionReady || !name.trim() || save.isPending}
          onClick={() => {
            setNotice('');
            save.mutate(selectedId || undefined);
          }}
        >
          {save.isPending ? '저장 중…' : '내 팀 저장'}
        </button>
        {selectedId && (
          <>
            <button
              className={action}
              disabled={save.isPending}
              onClick={() => save.mutate(undefined)}
            >
              새 팀으로 저장
            </button>
            <button
              className={action}
              disabled={remove.isPending}
              onClick={() => remove.mutate(selectedId)}
            >
              저장된 팀 삭제
            </button>
          </>
        )}
        <label className="flex min-w-0 flex-col gap-1 text-[14px] text-muted">
          상대 팀 불러오기
          <select
            className={control}
            aria-label="상대 팀 불러오기"
            value=""
            onChange={(e) => selectSaved(e.target.value, 'opponent')}
          >
            <option value="">직접 입력 / 저장된 팀 선택</option>
            {teams.data?.items.map((t) => (
              <option value={t.teamId} key={t.teamId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <p role="status" className="mb-3 text-[14px] text-accent">
          {notice}
        </p>
      )}
      {(save.error || remove.error || teams.error) && (
        <p role="alert" className="mb-3 text-[14px] text-warning">
          {(save.error ?? remove.error ?? teams.error)?.message}
          <button
            className={`${action} ml-2`}
            onClick={() => void teams.refetch()}
          >
            목록 다시 연결
          </button>
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 max-tablet:grid-cols-1">
        <TeamEditor title="내 팀" members={own} onChange={setOwn} />
        <TeamEditor title="상대 팀" members={opponent} onChange={setOpponent} />
      </div>
      {tab === 'team' ? (
        <section
          className="mt-4 rounded-[12px] border border-line bg-surface p-4"
          aria-label="팀 분석 결과"
        >
          <div className="flex flex-wrap gap-2">
            <button
              className={action}
              disabled={!valid || summary.busy}
              onClick={summary.run}
            >
              타입 상성 분석
            </button>
            <button
              className={action}
              disabled={
                !valid ||
                own.length !== 6 ||
                opponent.length !== 6 ||
                selection.busy
              }
              onClick={selection.run}
            >
              3마리·선봉 추천
            </button>
          </div>
          <p className="mt-2 text-[14px] text-muted">
            1–6마리 팀 비교 · 선출 비교는 양쪽 6마리 필요 · 같은 종 중복은 팀
            편집 정책으로 제한
          </p>
          <AnalysisState
            busy={summary.busy || selection.busy}
            error={summary.error ?? selection.error}
          />
          {summary.data && (
            <div className="mt-4">
              <h2 className="text-[14px] font-semibold">
                공격 커버리지 · 일반 타입 배율
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead>
                    <tr>
                      <th className="p-2">내 팀 / 상대</th>
                      {opponent.map((m) => (
                        <th className="p-2 whitespace-nowrap" key={m.pokemonId}>
                          {label(m.pokemonId)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.data.members.map((m) => (
                      <tr
                        key={m.pokemonId}
                        className="border-t border-line"
                      >
                        <th className="p-2 whitespace-nowrap font-medium">
                          {label(m.pokemonId)}
                        </th>
                        {m.coverage.map((c) => (
                          <td className="p-2 text-accent" key={c.pokemonId}>
                            {c.multiplier === null
                              ? '공격 기술 없음'
                              : `${c.multiplier}×`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="mt-4 text-[14px]">겹치는 약점과 교체 대응</h3>
              <ul className="mt-2 flex flex-wrap gap-2 text-[14px] text-muted">
                {summary.data.sharedWeaknesses.map((w) => (
                  <li
                    className="rounded-[6px] bg-canvas p-2"
                    key={w.attackType}
                  >
                    {typeLabels[w.attackType]} 약점 {w.weakCount} · 반감/무효{' '}
                    {w.resistCount}
                  </li>
                ))}
              </ul>
              {!summary.data.sharedWeaknesses.length && (
                <p className="mt-2 text-[14px]">
                  중복 타입 약점 없음 · 전투 안전 보장 아님
                </p>
              )}
              {summary.data.roleGaps.map((g) => (
                <p className="mt-3 text-[14px] text-muted" key={g}>
                  {g}
                </p>
              ))}
              <Evidence result={summary.data} />
            </div>
          )}
          {selection.data && (
            <div className="mt-5">
              {selection.data.recommendation && <SelectionRecommendation
                plan={selection.data.recommendation}
                label={label}
                onApply={() => {
                  setOwnActive(own.findIndex(m => m.pokemonId === selection.data!.recommendation!.leadId));
                  setTab('battle');
                }}
                onAsk={() => onAsk(`내 팀(${own.map(m => label(m.pokemonId)).join(', ')})과 상대 팀(${opponent.map(m => label(m.pokemonId)).join(', ')})에서 추천 선출은 ${selection.data!.recommendation!.pokemonIds.map(label).join(', ')}이고 선봉은 ${label(selection.data!.recommendation!.leadId)}입니다. 이 조합의 운영과 상대별 주의점을 전략 자료의 근거와 함께 설명해 주세요. 입력된 팀 정보: ${JSON.stringify({ own, opponent })}. 기술 미입력 멤버는 자기 타입 공격을 가정한 계산이며 실제 기술 보유를 확정하지 마세요.`)}
              />}
              <details className="mt-4">
              <summary className="cursor-pointer text-[14px] text-muted">다른 조합과 점수 비교</summary>
              <h2 className="mt-3 text-[14px] font-semibold">
                선출 후보 {selection.data.candidateCount}개 · 휴리스틱 점수
              </h2>
              <p className="mt-2 text-[14px] text-muted">
                점수 = 약점 공략 상대 수×2 + 가정 공격 반감 대응 수 - 중복 약점
                수 · 참가 합법성·승률 미검증
              </p>
              <ol className="mt-3 flex max-h-90 flex-col gap-2 overflow-auto">
                {selection.data.candidates.map((c, i) => (
                  <li
                    key={c.pokemonIds.join()}
                    className="rounded-[6px] border border-line p-3 text-[14px]"
                  >
                    <strong className="font-medium">
                      {i + 1}. {c.pokemonIds.map(label).join(' · ')}{' '}
                      <span className="text-accent">{c.score}점</span>
                    </strong>
                    <p className="mt-1 text-muted">
                      선봉 비교 후보: {label(c.leadId)} · 공략{' '}
                      {c.components.coveredOpponents} · 반감 대응{' '}
                      {c.components.resistedScenarios} · 중복 약점{' '}
                      {c.components.sharedWeaknessPenalty}
                    </p>
                  </li>
                ))}
              </ol>
              </details>
              <Evidence result={selection.data} />
            </div>
          )}
        </section>
      ) : (
        <section
          className="mt-4 rounded-[12px] border border-line bg-surface p-4"
          aria-label="전투 분석"
        >
          <h2 className="text-[14px] font-semibold">공격·교체·메가 시나리오</h2>
          <p className="my-2 text-[14px] text-muted">
            기술·HP는 위 멤버 카드에서 입력하세요. 공격 기술을 입력해야 공격
            대안을 비교합니다.
          </p>
          <div className="grid grid-cols-2 gap-3 max-phone:grid-cols-1">
            <label className="flex flex-col gap-1 text-[14px]">
              현재 내 포켓몬
              <select
                className={control}
                value={activeOwn}
                onChange={(e) => setOwnActive(Number(e.target.value))}
              >
                {own.map((m, i) => (
                  <option key={m.pokemonId} value={i}>
                    {label(m.pokemonId)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[14px]">
              현재 상대 포켓몬
              <select
                className={control}
                value={activeOpponent}
                onChange={(e) => setOpponentActive(Number(e.target.value))}
              >
                {opponent.map((m, i) => (
                  <option key={m.pokemonId} value={i}>
                    {label(m.pokemonId)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[14px]">
              메가 사용 상태
              <select
                className={control}
                value={megaUsed}
                onChange={(e) => setMegaUsed(e.target.value)}
              >
                <option value="unknown">미확인</option>
                <option value="unused">아직 사용하지 않음</option>
                <option value="used">이미 사용함</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[14px]">
              전환 후 폼 비교
              <select
                className={control}
                disabled={megaUsed === 'used'}
                value={megaTargetId}
                onChange={(e) => setMegaTargetId(e.target.value)}
              >
                <option value="">비교 안 함 / 폼 미확인</option>
                {possibleMega.map((p) => (
                  <option key={p.pokemonId} value={p.pokemonId}>
                    {p.nameKo ?? p.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[14px]">
              교체 봉쇄 상태
              <select
                className={control}
                value={switchBlocked}
                onChange={(e) => setSwitchBlocked(e.target.value)}
              >
                <option value="unknown">미확인</option>
                <option value="no">봉쇄 없음</option>
                <option value="yes">교체 불가</option>
              </select>
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-[14px]">
              상대 공개/가정 공격 타입 · 미선택 시 상대 입력 기술 또는 타입 가정
            </legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeLabels).map(([type, text]) => (
                <label
                  key={type}
                  className="flex items-center gap-1 text-[14px] text-muted"
                >
                  <input
                    type="checkbox"
                    checked={attackTypes.includes(type)}
                    onChange={(e) =>
                      setAttackTypes(
                        e.target.checked
                          ? [...attackTypes, type]
                          : attackTypes.filter((t) => t !== type),
                      )
                    }
                  />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            className={`${action} mt-4`}
            disabled={!valid || battle.busy}
            onClick={battle.run}
          >
            공격·교체 비교
          </button>
          <AnalysisState busy={battle.busy} error={battle.error} />
          {battle.data && (
            <div className="mt-4">
              <p className="text-[14px] leading-[1.9] text-warning">
                {battle.data.notice}
              </p>
              {(['attack', 'switch'] as const).map((kind) => (
                <div className="mt-4" key={kind}>
                  <h3 className="text-[14px]">
                    {kind === 'attack'
                      ? '공격 대안 · 타입 배율 내림차순'
                      : '교체 대안 · 가정 공격 배율 오름차순'}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {battle
                      .data!.options.filter((o) => o.kind === kind)
                      .sort(
                        (a, b) =>
                          (a.comparisonOrder ?? 99) - (b.comparisonOrder ?? 99),
                      )
                      .map((o) => (
                        <li
                          className="rounded-[6px] border border-line p-3 text-[14px]"
                          key={`${o.kind}-${o.pokemonId}-${o.label}`}
                        >
                          <strong className="font-medium">
                            {o.label} ·{' '}
                            {o.multiplier === null
                              ? '효과 미계산'
                              : `${o.multiplier}×`}
                          </strong>
                          <p className="mt-1 text-muted">{o.reason}</p>
                          {o.risks.map((r) => (
                            <p className="mt-1 text-muted" key={r}>
                              {r}
                            </p>
                          ))}
                        </li>
                      ))}
                  </ul>
                  {!battle.data!.options.some((o) => o.kind === kind) && (
                    <p className="mt-2 text-[14px] text-muted">
                      {kind === 'attack'
                        ? '입력한 공격 기술 없음 또는 현재 포켓몬이 쓰러진 상태'
                        : '생존한 교체 후보 없음 또는 교체 봉쇄 상태'}
                    </p>
                  )}
                </div>
              ))}
              <h3 className="mt-4 text-[14px]">메가 상태</h3>
              <p className="mt-2 text-[14px] text-muted">
                {battle.data.mega.reason}
              </p>
              {battle.data.mega.typeComparison?.map((t) => (
                <p className="mt-1 text-[14px]" key={t.attackType}>
                  {typeLabels[t.attackType]} 공격에 대한 방어: {t.before}× →{' '}
                  {t.after}×
                </p>
              ))}
              <Evidence result={battle.data} />
            </div>
          )}
        </section>
      )}
      <DamagePanel own={own} opponent={opponent} label={label} sessionReady={sessionReady} />
      <button
        className={`${action} my-5 flex items-center gap-2`}
        disabled={!own.length}
        onClick={() =>
          onAsk(
            `내 팀(${own.map((m) => label(m.pokemonId)).join(', ')})과 상대 팀(${opponent.map((m) => label(m.pokemonId)).join(', ') || '미입력'})의 준비를 도와줘. 수집 문서로 확인되는 특징과 추가로 확인할 정보를 출처와 함께 설명해줘. 일반 타입표 계산만으로 Champions 참가 가능 여부, 실제 피해, 승률이나 최선 행동을 단정하지 마.`,
          )
        }
      >
        <MessageSquare size={15} />이 구성으로 챗봇에 질문 준비
      </button>
    </div>
  );
}
