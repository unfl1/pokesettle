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
  return (
    <>
      {text.split(/(\[근거 \d+\])/g).map((part, index) => {
        const match = part.match(/^\[근거 (\d+)\]$/);
        return match && citations.some((c) => c.number === Number(match[1])) ? (
          <a
            key={index}
            className="mx-[3px] my-0 border border-[#a7efc540] text-[9px] inline-flex items-center justify-center min-w-[17px] h-[17px] rounded-[4px] text-accent bg-[#a7efc50a] align-super leading-[1]"
            href={`#${prefix}-${match[1]}`}
            aria-label={`근거 ${match[1]} 확인`}
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
  const href = sourceHref(citation.sourceUrl);
  return (
    <div>
      <a
        id={`${prefix}-${citation.number}`}
        className="px-3 py-[11px] border border-[#324052] gap-2.5 flex items-center bg-[#131c27] rounded-[7px] scroll-m-[15px] target:border-accent [&>svg]:ml-auto [&>svg]:text-[#78968d]"
        data-testid="evidence-card"
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={`근거 ${citation.number} 원문 열기`}
      >
        <span className="border border-[#a7efc52e] grid place-items-center text-accent rounded-[4px] w-[21px] h-[21px] text-[9px]">
          {citation.number}
        </span>
        <span className="min-w-0 [&_strong]:text-[10px] [&_strong]:font-medium [&_strong]:block [&_strong]:wrap-anywhere [&_small]:block [&_small]:text-[9px] [&_small]:text-[#728aa2] [&_small]:mt-[5px]">
          <strong>{citation.title}</strong>
          <small>
            {citation.sourceType === 'metadata'
              ? '도감 메타데이터'
              : citation.sourceType === 'calculation'
                ? '일반 타입 계산 · 조건부 판단'
              : citation.sourceType === 'curated'
                ? '직접 작성한 조건부 전략 · 가정 포함'
              : citation.sourceType === 'wiki'
                ? '위키 백과 자료'
                : '외부 설명 자료'}{' '}
            · 일반 도감 기준
          </small>
        </span>
        <ArrowUpRight size={15} aria-hidden="true" />
      </a>
      {['wiki', 'curated'].includes(citation.sourceType) && citation.licence && (
        <p className="mt-1 text-[9px] text-[#8295a8] wrap-anywhere">
          <a
            href={sourceHref(citation.licenceUrl ?? null)}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {citation.licence}
          </a>
        </p>
      )}
    </div>
  );
}

export function Answer({ result, id }: { result: GroundedResult; id: string }) {
  return (
    <div className="mb-7" data-testid="answer-body">
      <div
        className="gap-[7px] flex items-center text-[#b0dac3] text-[11px] mb-[11px]"
        data-testid="answer-label"
      >
        {result.feature === 'pokemon_guide' ? (
          <BookOpen size={14} />
        ) : (
          <ShieldCheck size={14} />
        )}
        <span>
          {result.feature === 'pokemon_guide'
            ? '근거 기반 운용 가이드'
            : result.feature === 'catalog_reference'
              ? '도감 바로 답변'
            : 'PokeTact'}
        </span>
        <span
          className="px-[5px] py-[3px] border border-[#344355] ml-auto text-[8px] text-[#849bb0] rounded-[4px]"
          data-testid="answer-state"
        >
          {result.answerStatus === 'abstained'
            ? '확인되지 않음'
            : result.answerStatus === 'partial'
              ? '일부 확인'
              : '근거 포함'}
        </span>
      </div>
      {result.battleContext && (
        <div className="mb-3 rounded-[6px] border border-[#344253] p-3 text-[11px] leading-[1.9] text-[#a3b2c3]" aria-label="현재 전투 입력">
          {result.battleContext.scope === 'generic_team_selection' ? <p>6대6 엔트리 비교{result.battleContext.selection ? ` · ${result.battleContext.selection.candidateCount}개 선출 조합 평가` : ' · 엔트리 확인 필요'}</p> : <p>현재 입력: {result.battleContext.ownName ?? '내 포켓몬 미확인'} / 상대 {result.battleContext.opponentName ?? '미확인'}</p>}
          {result.battleContext.state.ownHpPercent !== undefined && <p>내 남은 HP: {result.battleContext.state.ownHpPercent}%</p>}
          {result.battleContext.state.ownMoves?.length ? <p>입력한 기술: {result.battleContext.state.ownMoves.join(', ')}</p> : null}
          {result.battleContext.state.requestedDefensiveType && <p>요청한 방어 타입: {result.battleContext.state.requestedDefensiveType} · 가정 비교, 실제 사용 확정 아님</p>}
          {result.battleContext.switches?.length ? <div className="mt-2" aria-label="교체 후보 비교">
            <p className="font-medium">교체 후보 · 타입 저항 기준 비교</p>
            {result.battleContext.switches.map(option => <p key={option.pokemonId}>
              {option.comparisonOrder}. {option.name} · 최대 피격 배율 {option.worstMultiplier}배{option.hpPercent != null ? ` · HP ${option.hpPercent}%` : ' · HP 미입력'}
            </p>)}
            <p>같은 배율은 공동 순위 · 실제 생존·최선 행동 순위 아님</p>
          </div> : null}
          {result.battleContext.damageComparisons?.length ? <p>명시한 중립 조건의 참조 피해 계산 포함 · 실제 게임 검증과 구분</p> : <p>타입 기반 비교 · 실제 피해·선공·승률 미검증</p>}
        </div>
      )}
      <div
        className="text-[14px] leading-[1.95] text-[#c5d2e1] whitespace-pre-wrap wrap-anywhere max-tablet:text-[13px]"
        data-testid="answer-text"
      >
        <CitedText
          text={result.answer}
          citations={result.citations}
          prefix={id}
        />
      </div>
      {result.assumptions.length > 0 && (
        <div className="text-[10px] text-[#a99b7e] mt-[13px] leading-[1.9]">
          <strong>가정</strong>
          {result.assumptions.map((a, i) => (
            <p key={i}>{a.text}</p>
          ))}
        </div>
      )}
      {result.unknowns.length > 0 && (
        <details open={result.answerStatus !== 'answered'} className="text-[10px] text-[#a99b7e] mt-[13px] leading-[1.9] [&_summary]:gap-[5px] [&_summary]:flex [&_summary]:items-center [&_summary]:cursor-pointer [&_p]:mt-[7px]">
          <summary>
            <CircleHelp size={14} />
            미확인 정보 {result.unknowns.length}개
          </summary>
          {result.unknowns.map((item, i) => (
            <p key={i}>{item.reason}</p>
          ))}
        </details>
      )}
      {result.citations.length ? (
        <div className="gap-[7px] mt-[17px] flex flex-col [&>p]:mb-0.5">
          <p className="gap-1.5 text-[9px] tracking-[0.7px] text-[#8295a8] flex items-center">
            <FileText size={12} />
            실제로 사용한 근거 {result.citations.length}개
          </p>
          {result.citations.map((c) => (
            <EvidenceCard key={c.evidenceId} citation={c} prefix={id} />
          ))}
        </div>
      ) : (
        <p className="gap-1.5 text-[9px] text-[#8194a8] leading-[1.8] mt-2.5 flex items-center">
          <CircleHelp size={14} />
          {result.citationNotice ?? '이 답변에 인용된 근거가 없습니다.'}
        </p>
      )}
      {result.guideLimitations?.map((line, i) => (
        <p className="text-[9px] text-[#8194a8] leading-[1.8] mt-2.5" key={i}>
          {line}
        </p>
      ))}
    </div>
  );
}

export function ChatMessage({ message }: { message: Message }) {
  if (message.role === 'user')
    return (
      <div
        className="mt-0 mr-0 mb-6 ml-auto max-w-[85%] w-fit [&>span]:block [&>span]:text-[#79988b] [&>span]:text-right [&>span]:text-[9px] [&>span]:mb-[7px] [&_p]:px-4 [&_p]:py-3 [&_p]:border [&_p]:border-[#a7efc523] [&_p]:bg-[#a7efc50a] [&_p]:rounded-[9px_2px_9px_9px] [&_p]:text-[13px] [&_p]:leading-[1.8] [&_p]:whitespace-pre-wrap [&_p]:wrap-anywhere"
        data-testid="user-message"
      >
        <span>나의 질문</span>
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
        className="text-[14px] leading-[1.95] text-[#c5d2e1] whitespace-pre-wrap wrap-anywhere max-tablet:text-[13px]"
        data-testid="answer-text"
      >
        {message.content}
      </div>
    );
  return (
    <Answer result={message.content} id={`evidence-${message.messageId}`} />
  );
}
