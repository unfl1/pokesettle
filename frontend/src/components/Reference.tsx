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
            className="citation-mark"
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
    <a
      id={`${prefix}-${citation.number}`}
      className="evidence-card"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`근거 ${citation.number} 원문 열기`}
    >
      <span className="source-number">{citation.number}</span>
      <span className="source-copy">
        <strong>{citation.title}</strong>
        <small>
          {citation.sourceType === 'metadata'
            ? '도감 메타데이터'
            : '외부 설명 자료'}{' '}
          · 일반 도감 기준
        </small>
      </span>
      <ArrowUpRight size={15} aria-hidden="true" />
    </a>
  );
}

export function Answer({ result, id }: { result: GroundedResult; id: string }) {
  return (
    <div className="answer-body">
      <div className="answer-label">
        {result.feature === 'pokemon_guide' ? (
          <BookOpen size={14} />
        ) : (
          <ShieldCheck size={14} />
        )}
        <span>
          {result.feature === 'pokemon_guide'
            ? '근거 기반 운용 가이드'
            : 'PokéCoach'}
        </span>
        <span className="answer-state">
          {result.answerStatus === 'abstained'
            ? '확인되지 않음'
            : result.answerStatus === 'partial'
              ? '일부 확인'
              : '근거 포함'}
        </span>
      </div>
      <div className="answer-text">
        <CitedText
          text={result.answer}
          citations={result.citations}
          prefix={id}
        />
      </div>
      {result.assumptions.length > 0 && (
        <div className="note-box">
          <strong>가정</strong>
          {result.assumptions.map((a, i) => (
            <p key={i}>{a.text}</p>
          ))}
        </div>
      )}
      {result.unknowns.length > 0 && (
        <details className="unknowns">
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
        <div className="evidence-list">
          <p className="eyebrow">
            <FileText size={12} />
            실제로 사용한 근거 {result.citations.length}개
          </p>
          {result.citations.map((c) => (
            <EvidenceCard key={c.evidenceId} citation={c} prefix={id} />
          ))}
        </div>
      ) : (
        <p className="no-citation">
          <CircleHelp size={14} />
          {result.citationNotice ?? '이 답변에 인용된 근거가 없습니다.'}
        </p>
      )}
      {result.guideLimitations?.map((line, i) => (
        <p className="guide-limitation" key={i}>
          {line}
        </p>
      ))}
    </div>
  );
}

export function ChatMessage({ message }: { message: Message }) {
  if (message.role === 'user')
    return (
      <div className="user-message">
        <span>나의 질문</span>
        <p>
          {typeof message.content === 'string'
            ? message.content
            : message.content.answer}
        </p>
      </div>
    );
  if (typeof message.content === 'string')
    return <div className="answer-text">{message.content}</div>;
  return (
    <Answer result={message.content} id={`evidence-${message.messageId}`} />
  );
}
