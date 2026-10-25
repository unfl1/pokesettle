import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  BookOpenText,
  CircleHelp,
  FileSearch,
  LoaderCircle,
  MessageSquare,
  RotateCcw,
  RefreshCw,
  Send,
} from 'lucide-react';
import { ChatMessage } from './Reference';
import type { useWorkspace } from '../hooks/useWorkspace';

type Workspace = ReturnType<typeof useWorkspace>;
const stages: Record<string, string> = {
  validating: '질문을 확인하고 있어요',
  catalog_lookup: '도감 기본 정보를 확인하고 있어요',
  interpreting_battle: '말씀한 전투 상황을 정리하고 있어요',
  extracting_queries: '검색할 내용을 정리하고 있어요',
  searching: '관련 자료를 찾고 있어요',
  filtering: '질문에 맞는 문서를 고르고 있어요',
  collecting: '원문 자료를 확인하고 있어요',
  indexing: '자료를 검색할 수 있도록 준비하고 있어요',
  retrieving: '답변에 필요한 근거를 찾고 있어요',
  generating: '근거를 바탕으로 답변을 작성하고 있어요',
  validating_citations: '답변의 출처를 확인하고 있어요',
  saving: '대화 기록을 저장하고 있어요',
  done: '완료',
};

export default function ChatPanel({ workspace: w }: { workspace: Workspace }) {
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [w.messages.data, w.pending, w.job.data?.stage]);
  const error =
    w.failure?.message ??
    w.job.error?.message ??
    w.messages.error?.message ??
    w.conversations.error?.message ??
    w.createConversation.error?.message;
  const items = w.messages.data ?? [];
  const loading = w.messages.isPending && Boolean(w.conversationId);
  return (
    <section
      className="border border-line rounded-[12px] bg-surface overflow-hidden max-tablet:order-first"
      aria-label="전략 대화"
    >
      <header className="px-5.5 py-4.5 gap-[11px] flex items-center border-b border-b-line max-desktop:p-[17px] max-phone:gap-2 max-phone:flex-wrap [&_h1]:text-[14px] [&_h1]:font-semibold">
        <div className="p-2 border border-accent/15 bg-accent/7 text-accent rounded-[7px] flex">
          <MessageSquare size={17} />
        </div>
        <div className="min-w-0">
          <h1>전략 챗봇</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            포켓몬 배틀 상황을 물어보면, 근거를 바탕으로 전략을 안내해요.
          </p>
        </div>
        <div className="gap-2 ml-auto flex items-center min-w-0 max-phone:mx-0 max-phone:w-full max-phone:mt-1 max-phone:mb-0 [&_select]:p-[7px] [&_select]:border [&_select]:border-line [&_select]:bg-canvas [&_select]:text-muted [&_select]:rounded-[5px] [&_select]:text-[11px] [&_select]:max-w-42.5 max-desktop:[&_select]:max-w-30 max-phone:[&_select]:max-w-none max-phone:[&_select]:flex-1">
          <label className="sr-only" htmlFor="conversation-select">
            대화 기록 선택
          </label>
          <select
            id="conversation-select"
            value={w.conversationId ?? ''}
            onChange={(e) => w.chooseConversation(e.target.value)}
            disabled={w.busy || !w.conversations.data?.items.length}
          >
            <option value="" disabled>
              새 대화
            </option>
            {w.conversations.data?.items.map((c) => (
              <option key={c.conversationId} value={c.conversationId}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            className="border border-line flex items-center gap-1.5 px-2 py-1.5 rounded-[5px] text-[11px] text-muted whitespace-nowrap"
            title="빈 전투 상태로 새 대화 시작 · 이전 기록은 보관"
            aria-label="대화 초기화"
            onClick={w.createNew}
            disabled={
              w.busy || w.createConversation.isPending || !w.session.isSuccess
            }
          >
            <RotateCcw size={14} />
            대화 초기화
          </button>
        </div>
      </header>
      <div
        className="chat-feed"
        ref={feed}
        role="log"
        aria-label="대화 기록"
        aria-live="polite"
      >
        {loading && (
          <div
            className="px-0 py-4 gap-2.5 flex items-center text-accent text-[12px]"
            role="status"
          >
            <LoaderCircle
              className="animate-loading motion-reduce:animate-none"
              size={17}
            />
            이전 대화를 불러오고 있어요.
          </div>
        )}
        {!loading && !items.length && !w.pending && (
          <div className="px-0 flex items-center flex-col text-center pt-24 pb-3 max-tablet:pt-23 [&_h2]:text-[18px] [&_h2]:tracking-[-0.6px] [&_h2]:font-medium max-desktop:[&_h2]:text-[16px] max-phone:[&_h2]:text-[15px] [&>p]:mx-0 [&>p]:text-[12px] [&>p]:text-muted [&>p]:leading-[1.9] [&>p]:mt-[11px] [&>p]:mb-[23px]">
            <span className="border border-accent/19 grid place-items-center w-14 h-14 rounded-[17px] text-accent bg-accent/3 mb-5">
              <MessageSquare size={25} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2>어떤 배틀 상황이 궁금하세요?</h2>
            <p>
              내 포켓몬과 상대, 현재 상황을 알려주세요.
            </p>
            <div className="gap-2.5 flex flex-wrap justify-center [&_button]:px-3 [&_button]:py-[11px] [&_button]:border [&_button]:border-line [&_button]:gap-[9px] [&_button]:flex [&_button]:items-center [&_button]:rounded-[7px] [&_button]:text-ink [&_button]:text-[11px] [&_button]:bg-surface max-phone:[&_button]:text-[10px] [&_svg]:text-muted">
              <button
                onClick={() =>
                  w.setDraft('나 피카츄가 선봉인데 상대가 갸라도스야. 어떻게 할까?')
                }
              >
                <BookOpenText size={16} />
                <span>현재 대면에서 어떻게 할까?</span>
                <ArrowRight size={15} />
              </button>
              <button
                onClick={() =>
                  w.setDraft('상대와 교체 가능한 팀원을 알려주면 교체 후보를 비교해 줘.')
                }
              >
                <FileSearch size={16} />
                <span>교체 후보를 비교하고 싶어요</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
        {items.map((message) => (
          <ChatMessage key={message.messageId} message={message} />
        ))}
        {w.pending && (
          <>
            {w.pending.question && (
              <div
                className="mt-0 mr-0 mb-6 ml-auto max-w-[85%] w-fit [&>span]:block [&>span]:text-muted [&>span]:text-right [&>span]:text-[10px] [&>span]:mb-[7px] [&_p]:px-4 [&_p]:py-3 [&_p]:border [&_p]:border-accent/14 [&_p]:bg-accent/4 [&_p]:rounded-[9px_2px_9px_9px] [&_p]:text-[14px] [&_p]:leading-[1.8] [&_p]:whitespace-pre-wrap [&_p]:wrap-anywhere"
                data-testid="user-message"
              >
                <span>나의 요청</span>
                <p>{w.pending.question}</p>
              </div>
            )}
            <div
              className="px-0 py-4 gap-2.5 flex items-center text-accent text-[12px] [&_p]:text-[10px] [&_p]:text-muted [&_p]:mt-[7px] [&_strong]:font-medium"
              role="status"
            >
              <LoaderCircle
                size={17}
                className="animate-loading motion-reduce:animate-none"
              />
              <div>
                <strong>
                  {stages[w.job.data?.stage ?? 'validating'] ??
                    '요청을 처리하고 있어요'}
                </strong>
                <p>다른 메뉴를 살펴본 뒤 돌아와도 작업을 확인할 수 있어요.</p>
              </div>
            </div>
          </>
        )}
      </div>
      {error && (
        <div
          className="px-4 py-[13px] mx-5.5 border border-warning-line gap-[11px] flex items-center bg-warning-soft text-warning rounded-[8px] text-[12px] leading-[1.8] mt-0 mb-[15px] max-phone:mx-[13px] max-phone:mb-[13px] [&_button]:gap-[5px] [&_button]:text-[11px] [&_button]:text-ink [&_button]:flex [&_button]:items-center [&_button]:ml-auto [&_button]:whitespace-nowrap"
          role="alert"
        >
          <CircleHelp size={16} />
          <span>{error}</span>
          {w.failure?.retryable && w.failure.request ? (
            <button onClick={w.retry} disabled={w.busy}>
              다시 시도
            </button>
          ) : w.job.error || w.messages.error || w.conversations.error ? (
            <button
              onClick={() => {
                void w.job.refetch();
                void w.messages.refetch();
                w.refresh();
              }}
            >
              <RefreshCw size={13} />
              다시 확인
            </button>
          ) : null}
        </div>
      )}
      <form
        className="px-3.5 mx-5.5 border border-line mt-0 mb-5 pt-[13px] pb-2.5 bg-canvas rounded-[9px] max-phone:p-[11px] max-phone:mx-[13px] max-phone:mb-3.5 [&:focus-within]:border-accent/50 [&_textarea]:border-0 [&_textarea]:border-[currentColor] [&_textarea]:w-full [&_textarea]:bg-[transparent] [&_textarea]:resize-y [&_textarea]:max-h-45 [&_textarea]:min-h-[45px] [&_textarea]:outline-none [&_textarea]:text-ink [&_textarea]:text-[14px] [&_textarea]:leading-[1.8] [&_textarea::placeholder]:text-muted"
        onSubmit={(e) => {
          e.preventDefault();
          if (w.canSend && w.draft.trim()) w.submit('chat');
        }}
      >
        <label className="sr-only" htmlFor="chat-question">
          포켓몬 질문
        </label>
        <textarea
          id="chat-question"
          rows={2}
          maxLength={2000}
          placeholder="메시지를 입력하세요…"
          value={w.draft}
          onChange={(e) => w.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              if (w.canSend && w.draft.trim()) w.submit('chat');
            }
          }}
        />
        <div className="gap-2.5 flex justify-between items-center mt-[9px] [&>span]:gap-[5px] [&>span]:flex [&>span]:items-center [&>span]:text-[10px] [&>span]:text-muted max-phone:[&>span]:text-[10px]">
          <span>
            <CircleHelp size={12} />
            답변에 사용한 출처와 미확인 정보를 함께 안내해요.
          </span>
          <button
            className="grid place-items-center w-8 h-8 rounded-[6px] bg-accent text-white shrink-0"
            type="submit"
            aria-label="질문 보내기"
            disabled={!w.canSend || !w.draft.trim()}
          >
            {w.busy ? (
              <LoaderCircle
                size={17}
                className="animate-loading motion-reduce:animate-none"
              />
            ) : (
              <Send size={17} />
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
