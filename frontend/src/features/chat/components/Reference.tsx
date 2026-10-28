import { useI18n } from '../../../i18n/I18nProvider';
import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import type { Citation, GroundedResult, Message } from '../types';

function sourceHref(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function CitedText({
  text,
  citations,
  prefix,
}: {
  text: string;
  citations: Citation[];
  prefix: string;
}) {
  const { t: translate } = useI18n();
  return (
    <>
      {text.split(/(\[근거 \d+\])/g).map((part, index) => {
        const match = part.match(/^\[근거 (\d+)\]$/);
        return match && citations.some((c) => c.number === Number(match[1])) ? (
          <a
            key={index}
            className="mx-[3px] my-0 border border-link/25 text-[14px] inline-flex items-center justify-center min-w-[17px] h-[17px] rounded-[4px] text-link bg-link/4 align-super leading-[1]"
            href={`#${prefix}-${match[1]}`}
            aria-label={translate('근거 {number} 확인', { number: match[1] })}
          >
            {match[1]}
          </a>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}

export function EvidenceCard({
  citation,
  prefix,
}: {
  citation: Citation;
  prefix: string;
}) {
  const { t: translate } = useI18n();
  const href = sourceHref(citation.sourceUrl);
  return (
    <div>
      <a
        id={`${prefix}-${citation.number}`}
        className="px-3 py-[11px] border border-line gap-2.5 flex items-center bg-surface rounded-[7px] scroll-m-[15px] text-link hover:border-link/35 target:border-link [&>svg]:ml-auto [&>svg]:text-link"
        data-testid="evidence-card"
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={translate('근거 {number} 원문 열기', { number: citation.number })}
      >
        <span className="border border-link/18 grid place-items-center text-link rounded-[4px] w-[21px] h-[21px] text-[14px]">
          {citation.number}
        </span>
        <span className="min-w-0 [&_strong]:text-[14px] [&_strong]:font-medium [&_strong]:block [&_strong]:wrap-anywhere [&_small]:block [&_small]:text-[14px] [&_small]:text-muted [&_small]:mt-[5px]">
          <strong>{citation.title}</strong>
          <small>
            {citation.sourceType === 'metadata'
              ? translate("도감 메타데이터")
              : citation.sourceType === 'calculation'
                ? translate("일반 타입 계산 · 조건부 판단")
              : citation.sourceType === 'curated'
                ? translate("직접 작성한 조건부 전략 · 가정 포함")
              : citation.sourceType === 'wiki'
                ? translate("위키 백과 자료")
                : translate("외부 설명 자료")}{' '}
             {translate("· 일반 도감 기준")} </small>
        </span>
        <ArrowUpRight size={15} aria-hidden="true" />
      </a>
      {['wiki', 'curated'].includes(citation.sourceType) && citation.licence && (
        <p className="mt-1 text-[14px] text-muted wrap-anywhere">
          <a
            href={sourceHref(citation.licenceUrl ?? null)}
            target="_blank"
            rel="noreferrer"
            className="text-link underline"
          >
            {citation.licence}
          </a>
        </p>
      )}
    </div>
  );
}

export function Answer({ result, id }: { result: GroundedResult; id: string }) {
  const { t: translate } = useI18n();
  const citedNumbers = [...new Set([...result.answer.matchAll(/\[근거 (\d+)\]/g)]
    .map(match => Number(match[1])))].filter(number => result.citations.some(c => c.number === number));
  const answerText = result.answer.replace(/\s*\[근거 \d+\]/g, '').trim();
  const displayAnswer = citedNumbers.length
    ? `${answerText}\n\n${citedNumbers.map(number => `[근거 ${number}]`).join(' ')}`
    : answerText;
  return (
    <div className="mb-7" data-testid="answer-body">
      <div
        className="gap-[7px] flex items-center text-ink text-[14px] mb-[11px]"
        data-testid="answer-label"
      >
        {result.feature === 'pokemon_guide' ? (
          <BookOpen size={14} />
        ) : (
          <ShieldCheck size={14} />
        )}
        <span>
          {result.feature === 'pokemon_guide'
            ? translate("근거 기반 운용 가이드")
            : result.feature === 'catalog_reference'
              ? translate("도감 바로 답변")
            : 'PokeSettle'}
        </span>
        <span
          className="px-[5px] py-[3px] border border-line ml-auto text-[14px] text-muted rounded-[4px]"
          data-testid="answer-state"
        >
          {result.answerStatus === 'abstained'
            ? translate("확인되지 않음")
            : result.answerStatus === 'partial'
              ? translate("일부 확인")
              : translate("근거 포함")}
        </span>
      </div>
      <div
        className="text-[14px] leading-[1.95] text-ink whitespace-pre-wrap wrap-anywhere max-tablet:text-[14px]"
        data-testid="answer-text"
      >
        <CitedText
          text={displayAnswer}
          citations={result.citations}
          prefix={id}
        />
      </div>
      {result.assumptions.length > 0 && (
        <div className="text-[14px] text-warning mt-[13px] leading-[1.9]">
          <strong>{translate("가정")}</strong>
          {result.assumptions.map((a, i) => (
            <p key={i}>{a.text}</p>
          ))}
        </div>
      )}
      {result.unknowns.length > 0 && (
        <details open={result.answerStatus !== 'answered'} className="text-[14px] text-warning mt-[13px] leading-[1.9] [&_summary]:gap-[5px] [&_summary]:flex [&_summary]:items-center [&_summary]:cursor-pointer [&_p]:mt-[7px]">
          <summary>
            <CircleHelp size={14} />
             {translate("미확인 정보")} {result.unknowns.length}{translate("개")} </summary>
          {result.unknowns.map((item, i) => (
            <p key={i}>{item.reason}</p>
          ))}
        </details>
      )}
      {result.battleContext && (
        <div className="mt-4 mb-3 rounded-[6px] border border-line p-3 text-[14px] leading-[1.9] text-muted" aria-label={translate("현재 전투 입력")}>
          {result.battleContext.scope === 'generic_team_selection' ? <p>{translate("6대6 엔트리 비교")}{result.battleContext.selection ? ` ${translate('· {count}개 선출 조합 평가', { count: result.battleContext.selection.candidateCount })}` : translate("· 엔트리 확인 필요")}</p> : <p>{translate("현재 입력:")} {result.battleContext.ownName ?? translate("내 포켓몬 미확인")}  {translate("/ 상대")} {result.battleContext.opponentName ?? translate("미확인")}</p>}
          {result.battleContext.state.ownHpPercent !== undefined && <p>{translate("내 남은 HP:")} {result.battleContext.state.ownHpPercent}%</p>}
          {result.battleContext.state.ownMoves?.length ? <p>{translate("입력한 기술:")} {result.battleContext.state.ownMoves.join(', ')}</p> : null}
          {result.battleContext.state.requestedDefensiveType && <p>{translate("요청한 방어 타입:")} {result.battleContext.state.requestedDefensiveType}  {translate("· 가정 비교, 실제 사용 확정 아님")}</p>}
          {result.battleContext.switches?.length ? <div className="mt-2" aria-label={translate("교체 후보 비교")}>
            <p className="font-medium">{translate("교체 후보 · 타입 저항 기준 비교")}</p>
            {result.battleContext.switches.map(option => <p key={option.pokemonId}>
              {option.comparisonOrder}. {option.name}  {translate("· 최대 피격 배율")} {option.worstMultiplier}{translate("배")}{option.hpPercent != null ? ` · HP ${option.hpPercent}%` : translate("· HP 미입력")}
            </p>)}
            <p>{translate("같은 배율은 공동 순위 · 실제 생존·최선 행동 순위 아님")}</p>
          </div> : null}
          {result.battleContext.damageComparisons?.length ? <p>{translate("명시한 중립 조건의 참조 피해 계산 포함 · 실제 게임 검증과 구분")}</p> : <p>{translate("타입 기반 비교 · 실제 피해·선공·승률 미검증")}</p>}
        </div>
      )}
      {result.guideLimitations?.map((line, i) => (
        <p className="text-[14px] text-muted leading-[1.8] mt-2.5" key={i}>
          {line}
        </p>
      ))}
      {result.citations.length ? (
        <div className="gap-[7px] mt-[17px] flex flex-col [&>p]:mb-0.5">
          <p className="gap-1.5 text-[14px] tracking-[0.7px] text-muted flex items-center">
            <FileText size={12} />
             {translate("실제로 사용한 근거")} {result.citations.length}{translate("개")} </p>
          {result.citations.map((c) => (
            <EvidenceCard key={c.evidenceId} citation={c} prefix={id} />
          ))}
        </div>
      ) : (
        <p className="gap-1.5 text-[14px] text-muted leading-[1.8] mt-2.5 flex items-center">
          <CircleHelp size={14} />
          {result.citationNotice ?? translate("이 답변에 인용된 근거가 없습니다.")}
        </p>
      )}
    </div>
  );
}

export function ChatMessage({ message }: { message: Message }) {
  const { t: translate } = useI18n();
  if (message.role === 'user')
    return (
      <div
        className="mt-0 mr-0 mb-6 ml-auto max-w-[85%] w-fit [&>span]:block [&>span]:text-muted [&>span]:text-right [&>span]:text-[14px] [&>span]:mb-[7px] [&_p]:px-4 [&_p]:py-3 [&_p]:border [&_p]:border-accent/14 [&_p]:bg-accent/4 [&_p]:rounded-[9px_2px_9px_9px] [&_p]:text-[14px] [&_p]:leading-[1.8] [&_p]:whitespace-pre-wrap [&_p]:wrap-anywhere"
        data-testid="user-message"
      >
        <span>{translate("나의 질문")}</span>
        <p>
          {typeof message.content === 'string'
            ? message.content
            : message.content.answer}
        </p>
      </div>
    );
  if (typeof message.content === 'string')
    return (
      <div
        className="text-[14px] leading-[1.95] text-ink whitespace-pre-wrap wrap-anywhere max-tablet:text-[14px]"
        data-testid="answer-text"
      >
        {message.content}
      </div>
    );
  return (
    <Answer result={message.content} id={`evidence-${message.messageId}`} />
  );
}
