import { useEffect } from 'react';
import type { GroundedResult } from '../types';
import { useCharacterReveal } from '../hooks/useCharacterReveal';
import { ChatMessage } from './Reference';

export function LiveAnswer({ preview, result, onComplete, onProgress }: {
  preview: string;
  result: GroundedResult | null;
  onComplete: () => void;
  onProgress: () => void;
}) {
  const target = result?.answer ?? preview;
  const visible = useCharacterReveal(target);
  const finished = result !== null && visible === target;

  useEffect(() => { onProgress(); }, [visible, onProgress]);
  useEffect(() => { if (finished) onComplete(); }, [finished, onComplete]);

  if (finished) return <ChatMessage message={{messageId: 'pending-answer', role: 'assistant', content: result, createdAt: ''}} />;
  if (!target) return null;
  return (
    <div data-testid="answer-stream" aria-live="off" aria-busy="true" className="mb-7 text-[14px] leading-[1.9]">
      <span className="block mb-3 font-medium">PokeSettle</span>
      <p className="whitespace-pre-wrap wrap-anywhere">
        <span data-testid="answer-stream-text">{visible}</span>
        <span aria-hidden="true" className="text-accent">▍</span>
      </p>
    </div>
  );
}
