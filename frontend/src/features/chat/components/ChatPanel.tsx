import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  BookOpenText,
  Check,
  CircleHelp,
  FileSearch,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { ChatMessage } from './Reference';
import type { useWorkspace } from '../hooks/useWorkspace';

type Workspace = ReturnType<typeof useWorkspace>;
const stages: Record<string, string> = {
  validating: '질문을 확인하고 있어요',
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
      className="border border-[#334150] rounded-[12px] bg-[#171f2a] overflow-hidden"
      aria-label="포켓몬별 근거 대화"
    >
      <header className="px-5.5 py-4.5 gap-[11px] flex items-center border-b border-b-[#2b3746] max-desktop:p-[17px] max-phone:gap-2 max-phone:flex-wrap [&_h2]:text-[13px] [&_h2]:font-semibold [&_p]:text-[9px] [&_p]:text-[#8194aa] [&_p]:mt-[5px] max-tablet:[&_p]:text-[8px]">
        <div className="p-2 border border-[#a7efc527] bg-[#a7efc511] text-accent rounded-[7px] flex">
          <MessageSquare size={17} />
        </div>
        <div>
          <h2>근거와 함께 대화하기</h2>
          <p>대화 주제: {w.detail.data?.nameKo ?? w.detail.data?.nameEn ?? "불러오는 중"} · 포켓몬별 기록 보관</p>
        </div>
        <div className="gap-2 ml-auto flex items-center min-w-0 max-phone:mx-0 max-phone:w-full max-phone:mt-1 max-phone:mb-0 [&_select]:p-[7px] [&_select]:border [&_select]:border-[#344253] [&_select]:bg-[#111a25] [&_select]:text-[#99acc0] [&_select]:rounded-[5px] [&_select]:text-[10px] [&_select]:max-w-42.5 max-desktop:[&_select]:max-w-30 max-phone:[&_select]:max-w-none max-phone:[&_select]:flex-1">
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
            className="border border-[#344253] grid place-items-center w-[29px] h-[29px] rounded-[5px] text-[#a0b1c5]"
            title="새 대화"
            aria-label="새 대화 만들기"
            onClick={w.createNew}
            disabled={
              w.busy || w.createConversation.isPending || !w.session.isSuccess
            }
          >
            <Plus size={18} />
          </button>
        </div>
      </header>
      <div
        className="px-6.5 py-5.5 h-[clamp(360px,_calc(100dvh_-_490px),_760px)] overflow-auto [scrollbar-width:thin] [scrollbar-color:#354253_transparent] max-tablet:p-5 max-tablet:h-105 max-phone:px-[15px] max-phone:py-4.5 tall:h-[510px]"
        ref={feed}
        role="log"
        aria-label="대화 기록"
        aria-live="polite"
      >
        {loading && (
          <div
            className="px-0 py-4 gap-2.5 flex items-center text-accent text-[11px]"
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
          <div className="px-0 flex items-center flex-col text-center pt-8 pb-3 max-tablet:pt-7 [&_h3]:text-[18px] [&_h3]:tracking-[-0.6px] [&_h3]:font-medium max-desktop:[&_h3]:text-[16px] max-phone:[&_h3]:text-[15px] [&>p]:mx-0 [&>p]:text-[11px] [&>p]:text-[#8a9eb5] [&>p]:leading-[1.9] [&>p]:mt-[11px] [&>p]:mb-[23px] [&>small]:gap-1.5 [&>small]:flex [&>small]:items-center [&>small]:text-[9px] [&>small]:text-[#637e92] [&>small]:mt-[21px]">
            <span className="border border-[#a7efc530] grid place-items-center w-14 h-14 rounded-[17px] text-accent bg-[#a7efc508] mb-5">
              <Sparkles size={25} strokeWidth={1.4} />
            </span>
            <h3>궁금한 점을 근거로 확인해 보세요.</h3>
            <p>
              도감 정보부터 원문 설명까지.
              <br />
              확인할 수 없는 내용은 추측하지 않아요.
            </p>
            <div className="gap-2.5 flex flex-wrap justify-center [&_button]:px-3 [&_button]:py-[11px] [&_button]:border [&_button]:border-[#334253] [&_button]:gap-[9px] [&_button]:flex [&_button]:items-center [&_button]:rounded-[7px] [&_button]:text-[#b3c3d5] [&_button]:text-[10px] [&_button]:bg-[#1d2835] max-phone:[&_button]:text-[9px] [&_svg]:text-[#8db09e]">
              <button
                onClick={() =>
                  w.setDraft('이 포켓몬의 타입과 특성 이름을 알려줘.')
                }
              >
                <BookOpenText size={16} />
                <span>기본 특징이 궁금해요</span>
                <ArrowRight size={15} />
              </button>
              <button
                onClick={() =>
                  w.setDraft('이 포켓몬의 도감 설명을 출처와 함께 알려줘.')
                }
              >
                <FileSearch size={16} />
                <span>도감에는 어떻게 설명되어 있나요?</span>
                <ArrowRight size={15} />
              </button>
            </div>
            <small>
              <Check size={12} />
              답변에 실제 사용한 출처를 함께 보여드립니다.
            </small>
          </div>
        )}
        {items.map((message) => (
          <ChatMessage key={message.messageId} message={message} />
        ))}
        {w.pending && (
          <>
            {w.pending.question && (
              <div
                className="mt-0 mr-0 mb-6 ml-auto max-w-[85%] w-fit [&>span]:block [&>span]:text-[#79988b] [&>span]:text-right [&>span]:text-[9px] [&>span]:mb-[7px] [&_p]:px-4 [&_p]:py-3 [&_p]:border [&_p]:border-[#a7efc523] [&_p]:bg-[#a7efc50a] [&_p]:rounded-[9px_2px_9px_9px] [&_p]:text-[13px] [&_p]:leading-[1.8] [&_p]:whitespace-pre-wrap [&_p]:wrap-anywhere"
                data-testid="user-message"
              >
                <span>나의 요청</span>
                <p>{w.pending.question}</p>
              </div>
            )}
            <div
              className="px-0 py-4 gap-2.5 flex items-center text-accent text-[11px] [&_p]:text-[9px] [&_p]:text-[#7d95ac] [&_p]:mt-[7px] [&_strong]:font-medium"
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
                <p>다른 포켓몬을 살펴본 뒤 돌아와도 작업을 확인할 수 있어요.</p>
              </div>
            </div>
          </>
        )}
      </div>
      {error && (
        <div
          className="px-4 py-[13px] mx-5.5 border border-[#d3b97c36] gap-[11px] flex items-center bg-[#d3b97c08] text-[#c4b38f] rounded-[8px] text-[11px] leading-[1.8] mt-0 mb-[15px] max-phone:mx-[13px] max-phone:mb-[13px] [&_button]:gap-[5px] [&_button]:text-[10px] [&_button]:text-[#b4d8c6] [&_button]:flex [&_button]:items-center [&_button]:ml-auto [&_button]:whitespace-nowrap"
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
        className="px-3.5 mx-5.5 border border-[#465a67] mt-0 mb-5 pt-[13px] pb-2.5 bg-[#111b24] rounded-[9px] max-phone:p-[11px] max-phone:mx-[13px] max-phone:mb-3.5 [&:focus-within]:border-[#a7efc580] [&_textarea]:border-0 [&_textarea]:border-[currentColor] [&_textarea]:w-full [&_textarea]:bg-[transparent] [&_textarea]:resize-y [&_textarea]:max-h-45 [&_textarea]:min-h-[45px] [&_textarea]:outline-none [&_textarea]:text-[#e0e9f0] [&_textarea]:text-[13px] [&_textarea]:leading-[1.8] [&_textarea::placeholder]:text-[#63798f]"
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
          placeholder="선택한 포켓몬에 대해 질문해 보세요…"
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
        <div className="gap-2.5 flex justify-between items-center mt-[9px] [&>span]:gap-[5px] [&>span]:flex [&>span]:items-center [&>span]:text-[9px] [&>span]:text-[#6f879c] max-phone:[&>span]:text-[8px]">
          <span>
            <CircleHelp size={12} />
            Champions 전용 규칙은 확인된 근거가 필요해요.
          </span>
          <button
            className="grid place-items-center w-8 h-8 rounded-[6px] bg-accent text-[#17382b] shrink-0"
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
