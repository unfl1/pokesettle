import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, test, vi } from "vitest";
import { useWorkspace } from "../../frontend/src/features/chat/hooks/useWorkspace";
import { chatApi } from "../../frontend/src/features/chat/api";

vi.mock("../../frontend/src/features/chat/api", () => ({
  chatApi: {
    conversations: vi.fn(async () => ({ items: [], total: 0 })),
    messages: vi.fn(async () => []),
    chat: vi.fn(async () => ({ jobId: "job-1" })),
    job: vi.fn(async () => ({
      jobId: "job-1",
      status: "running",
      stage: "generating",
      result: null,
      error: null,
    })),
  },
}));
vi.mock("../../frontend/src/lib/systemApi", () => ({
  systemApi: {
    session: vi.fn(async () => ({ sessionId: "session" })),
    status: vi.fn(async () => ({})),
  },
}));

class Events {
  static instances: Events[] = [];
  closed = false;
  listener?: (event: { data: string }) => void;
  constructor(public url: string) {
    Events.instances.push(this);
  }
  addEventListener(_name: string, listener: Events["listener"]) {
    this.listener = listener;
  }
  close() {
    this.closed = true;
  }
  emit(value: unknown) {
    this.listener?.({ data: JSON.stringify(value) });
  }
}
beforeEach(() => {
  sessionStorage.clear();
  Events.instances = [];
  vi.stubGlobal("EventSource", Events);
});

function workspace() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  );
  return renderHook(({ enabled }) => useWorkspace("", enabled, true), {
    wrapper,
    initialProps: { enabled: true },
  });
}

test("receives growing previews, resets rejected drafts and ignores stale snapshots without resubmitting", async () => {
  const hook = workspace();
  await waitFor(() => expect(hook.result.current.canSend).toBe(true));
  act(() => hook.result.current.setDraft("특성 설명해줘"));
  act(() => hook.result.current.submit("chat"));
  await waitFor(() => expect(Events.instances).toHaveLength(1));
  const source = Events.instances[0];
  const emit = (previewAnswer: string, updatedAt: string) =>
    act(() =>
      source.emit({
        jobId: "job-1",
        status: "running",
        stage: "generating",
        previewAnswer,
        updatedAt,
        result: null,
        error: null,
      }),
    );
  emit("피카", "2026-11-18T00:00:01Z");
  await waitFor(() =>
    expect(hook.result.current.job.data?.previewAnswer).toBe("피카"),
  );
  emit("피카츄는 전기 타입", "2026-11-18T00:00:02Z");
  await waitFor(() =>
    expect(hook.result.current.job.data?.previewAnswer).toBe(
      "피카츄는 전기 타입",
    ),
  );
  emit("old", "2026-11-18T00:00:01Z");
  expect(hook.result.current.job.data?.previewAnswer).not.toBe("old");
  emit("", "2026-11-18T00:00:03Z");
  await waitFor(() =>
    expect(hook.result.current.job.data?.previewAnswer).toBe(""),
  );
  expect(sessionStorage.getItem("pokecoach-pending")).not.toContain("피카");
  expect(chatApi.chat).toHaveBeenCalledTimes(1);
  hook.rerender({ enabled: false });
  expect(source.closed).toBe(true);
  hook.unmount();
});

test("a completed stream loads saved history, closes the subscription and removes pending state", async () => {
  const hook = workspace();
  await waitFor(() => expect(hook.result.current.canSend).toBe(true));
  act(() => hook.result.current.setDraft("test"));
  act(() => hook.result.current.submit("chat"));
  await waitFor(() => expect(Events.instances).toHaveLength(1));
  const source = Events.instances[0];
  act(() =>
    source.emit({
      jobId: "job-1",
      status: "completed",
      stage: "done",
      previewAnswer: "",
      result: { conversationId: "conversation-1", answer: "saved answer" },
      error: null,
    }),
  );
  await waitFor(() => expect(hook.result.current.pending).toBeUndefined());
  expect(hook.result.current.conversationId).toBe("conversation-1");
  expect(chatApi.messages).toHaveBeenCalledWith("conversation-1");
  expect(source.closed).toBe(true);
  hook.unmount();
});

test("a history load error releases pending state so the existing retry UI can recover", async () => {
  vi.mocked(chatApi.messages).mockRejectedValue(
    new Error("history unavailable"),
  );
  const hook = workspace();
  await waitFor(() => expect(hook.result.current.canSend).toBe(true));
  act(() => hook.result.current.setDraft("test"));
  act(() => hook.result.current.submit("chat"));
  await waitFor(() => expect(Events.instances).toHaveLength(1));
  act(() =>
    Events.instances[0].emit({
      jobId: "job-1",
      status: "completed",
      stage: "done",
      result: { conversationId: "conversation-error", answer: "saved" },
      error: null,
    }),
  );
  await waitFor(() => expect(hook.result.current.pending).toBeUndefined());
  expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.messages.isError).toBe(true);
  hook.unmount();
});
