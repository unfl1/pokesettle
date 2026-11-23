import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useCharacterReveal } from "../../frontend/src/features/chat/hooks/useCharacterReveal";
import { LiveAnswer } from "../../frontend/src/features/chat/components/LiveAnswer";
import type { GroundedResult } from "../../frontend/src/features/chat/types";

vi.mock("../../frontend/src/features/chat/components/Reference", () => ({
  ChatMessage: ({ message }: { message: { content: GroundedResult } }) => (
    <div data-testid="saved-answer">{message.content.answer}</div>
  ),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function timer() {
  vi.useFakeTimers();
}
function tick(ms = 25) {
  act(() => vi.advanceTimersByTime(ms));
}

test("large SSE chunks reveal exactly one Korean or emoji grapheme per tick", () => {
  timer();
  const hook = renderHook(({ text }) => useCharacterReveal(text), {
    initialProps: { text: "한글👨‍👩‍👧‍👦" },
  });
  expect(hook.result.current).toBe("");
  tick(24);
  expect(hook.result.current).toBe("");
  tick(1);
  expect(hook.result.current).toBe("한");
  tick();
  expect(hook.result.current).toBe("한글");
  tick();
  expect(hook.result.current).toBe("한글👨‍👩‍👧‍👦");
  hook.rerender({ text: "한글👨‍👩‍👧‍👦입니다" });
  expect(hook.result.current).toBe("한글👨‍👩‍👧‍👦");
  tick();
  expect(hook.result.current).toBe("한글👨‍👩‍👧‍👦입");
});

test("rejected drafts reset, replacements start from the beginning and unmount cancels timers", () => {
  timer();
  const hook = renderHook(({ text }) => useCharacterReveal(text), {
    initialProps: { text: "초안" },
  });
  tick();
  expect(hook.result.current).toBe("초");
  hook.rerender({ text: "교체" });
  expect(hook.result.current).toBe("");
  tick();
  expect(hook.result.current).toBe("교");
  hook.rerender({ text: "" });
  expect(hook.result.current).toBe("");
  hook.rerender({ text: "수정된 답변" });
  expect(hook.result.current).toBe("");
  tick();
  expect(hook.result.current).toBe("수");
  hook.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test("completion before playback ends drains the final answer before showing the saved answer", () => {
  timer();
  const onComplete = vi.fn(),
    onProgress = vi.fn();
  const result = { answer: "한글답변" } as GroundedResult;
  const view = render(
    <LiveAnswer
      preview="한글"
      result={null}
      onComplete={onComplete}
      onProgress={onProgress}
    />,
  );
  tick();
  expect(screen.getByTestId("answer-stream-text")).toHaveTextContent("한");
  view.rerender(
    <LiveAnswer
      preview=""
      result={result}
      onComplete={onComplete}
      onProgress={onProgress}
    />,
  );
  expect(onComplete).not.toHaveBeenCalled();
  expect(screen.queryByTestId("saved-answer")).not.toBeInTheDocument();
  tick();
  expect(screen.getByTestId("answer-stream-text")).toHaveTextContent("한글");
  tick();
  expect(screen.getByTestId("answer-stream-text")).toHaveTextContent("한글답");
  tick();
  expect(screen.getByTestId("saved-answer")).toHaveTextContent("한글답변");
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test("calculated answers without any draft still type one character at a time", () => {
  timer();
  const result = { answer: "선출추천" } as GroundedResult;
  const finish = vi.fn();
  render(
    <LiveAnswer
      preview=""
      result={result}
      onComplete={finish}
      onProgress={() => {}}
    />,
  );
  expect(screen.getByTestId("answer-stream-text").textContent).toBe("");
  tick();
  expect(screen.getByTestId("answer-stream-text").textContent).toBe("선");
  expect(finish).not.toHaveBeenCalled();
});

test("reduced motion shows the complete answer without artificial typing delay", () => {
  timer();
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const hook = renderHook(() => useCharacterReveal("전체 답변"));
  expect(hook.result.current).toBe("전체 답변");
  expect(vi.getTimerCount()).toBe(0);
});
