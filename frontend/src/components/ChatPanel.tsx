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
    <section className="chat-panel" aria-label="포켓몬별 근거 대화">
      <header className="chat-heading">
        <div className="section-icon">
          <MessageSquare size={17} />
        </div>
        <div>
          <h2>근거와 함께 대화하기</h2>
          <p>선택한 포켓몬의 기록이 따로 보관됩니다.</p>
        </div>
        <div className="chat-actions">
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
            className="icon-button"
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
        className="chat-feed"
        ref={feed}
        role="log"
        aria-label="대화 기록"
        aria-live="polite"
      >
        {loading && (
          <div className="loading-line" role="status">
            <LoaderCircle className="spin" size={17} />
            이전 대화를 불러오고 있어요.
          </div>
        )}
        {!loading && !items.length && !w.pending && (
          <div className="chat-welcome">
            <span className="welcome-icon">
              <Sparkles size={25} strokeWidth={1.4} />
            </span>
            <h3>궁금한 점을 근거로 확인해 보세요.</h3>
            <p>
              도감 정보부터 원문 설명까지.
              <br />
              확인할 수 없는 내용은 추측하지 않아요.
            </p>
            <div className="question-suggestions">
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
              <div className="user-message pending-question">
                <span>나의 요청</span>
                <p>{w.pending.question}</p>
              </div>
            )}
            <div className="working-state" role="status">
              <LoaderCircle size={17} className="spin" />
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
        <div className="chat-error" role="alert">
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
        className="composer"
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
        <div className="composer-bottom">
          <span>
            <CircleHelp size={12} />
            Champions 전용 규칙은 확인된 근거가 필요해요.
          </span>
          <button
            className="send-button"
            type="submit"
            aria-label="질문 보내기"
            disabled={!w.canSend || !w.draft.trim()}
          >
            {w.busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Send size={17} />
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
