import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../../lib/apiClient';
import { systemApi } from '../../../lib/systemApi';
import { chatApi } from '../api';
import type { Job, PendingJob } from '../types';

interface SendRequest {
  pokemonId: string;
  referencePokemonId?: string;
  conversationId: string | null;
  question: string;
  kind: 'chat' | 'guide';
  clientRequestId: string;
}
interface Failure {
  pokemonId: string;
  message: string;
  request?: SendRequest;
  retryable: boolean;
}

function readPending(): Record<string, PendingJob> {
  try {
    const value = JSON.parse(
      sessionStorage.getItem('pokecoach-pending') ?? '{}',
    );
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, PendingJob] =>
          typeof entry[1] === 'object' &&
          entry[1] !== null &&
          typeof (entry[1] as PendingJob).jobId === 'string',
      ),
    );
  } catch {
    return {};
  }
}

export function useWorkspace(initialDraft = '', chatEnabled = true, sessionEnabled = true) {
  const pokemonId = 'workspace';
  const cache = useQueryClient();
  const session = useQuery({
    queryKey: ['session'],
    enabled: sessionEnabled,
    queryFn: systemApi.session,
    staleTime: Infinity,
    retry: false,
  });
  const status = useQuery({
    queryKey: ['status'],
    enabled: sessionEnabled,
    queryFn: systemApi.status,
    staleTime: 15000,
    refetchInterval: sessionEnabled ? 15000 : false,
  });
  const conversations = useQuery({
    queryKey: ['conversations', pokemonId],
    queryFn: () => chatApi.conversations(pokemonId),
    staleTime: 30000,
    enabled: chatEnabled && session.isSuccess,
  });
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const [restored, setRestored] = useState(false);
  const conversationId = Object.hasOwn(choices, pokemonId)
    ? choices[pokemonId]
    : (conversations.data?.items[0]?.conversationId ?? null);
  useEffect(() => {
    if (!restored) return;
    try {
      if (conversationId) sessionStorage.setItem('poketact-conversation', conversationId);
      else sessionStorage.removeItem('poketact-conversation');
    }
    catch { /* storage may be disabled */ }
  }, [conversationId, restored]);
  const messages = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => chatApi.messages(conversationId!),
    staleTime: 30000,
    enabled: chatEnabled && session.isSuccess && Boolean(conversationId),
  });
  useEffect(() => {
    if (messages.error instanceof ApiError && messages.error.code === 'RESOURCE_NOT_FOUND') {
      setChoices(previous => { const next = {...previous}; delete next.workspace; return next; });
      try { sessionStorage.removeItem('poketact-conversation'); } catch { /* storage may be disabled */ }
    }
  }, [messages.error]);
  const [jobs, setJobs] = useState<Record<string, PendingJob>>({});
  useEffect(() => {
    setJobs(readPending());
    try {
      const id = sessionStorage.getItem('poketact-conversation');
      if (id) setChoices({ workspace: id });
    } catch { /* storage may be disabled */ }
    setRestored(true);
  }, []);
  const [drafts, setDrafts] = useState<Record<string, string>>({ workspace: initialDraft });
  const [failure, setFailure] = useState<Failure | null>(null);
  const [lastRequests, setLastRequests] = useState<Record<string, SendRequest>>(
    {},
  );
  const pending = jobs[pokemonId];
  const pendingJobId = pending?.jobId;
  const [displayedJobId, setDisplayedJobId] = useState<string | null>(null);
  const [historyReadyJobId, setHistoryReadyJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!restored) return;
    // Persist only opaque job/conversation IDs, never questions or answers.
    try {
      sessionStorage.setItem(
        'pokecoach-pending',
        JSON.stringify(
          Object.fromEntries(
            Object.entries(jobs).map(([id, job]) => [
              id,
              { ...job, question: '' },
            ]),
          ),
        ),
      );
    } catch {
      /* storage may be disabled */
    }
  }, [jobs, restored]);

  const send = useMutation({
    mutationFn: (body: SendRequest) =>
      body.kind === 'guide'
        ? chatApi.guide(body.referencePokemonId!, body.conversationId, body.clientRequestId)
        : chatApi.chat(
            body.pokemonId,
            body.question,
            body.conversationId,
            body.clientRequestId,
          ),
    onMutate: (body) => {
      setFailure(null);
      setLastRequests((previous) => ({ ...previous, [body.pokemonId]: body }));
    },
    onSuccess: (data, body) => {
      setJobs((previous) => ({
        ...previous,
        [body.pokemonId]: {
          jobId: data.jobId,
          question:
            body.kind === 'guide'
              ? '근거 기반 운용 가이드를 준비해 주세요.'
              : body.question,
          conversationId: body.conversationId,
        },
      }));
      setDrafts((previous) => ({ ...previous, [body.pokemonId]: '' }));
    },
    onError: (error, body) =>
      setFailure({
        pokemonId: body.pokemonId,
        message: error.message,
        request: body,
        retryable: !(error instanceof ApiError) || error.retryable,
      }),
  });

  const job = useQuery({
    queryKey: ['job', pending?.jobId],
    queryFn: async () => {
      const snapshot = await chatApi.job(pending!.jobId);
      const current = cache.getQueryData<Job>(['job', pending!.jobId]);
      return current?.updatedAt && snapshot.updatedAt && current.updatedAt > snapshot.updatedAt ? current : snapshot;
    },
    enabled: chatEnabled && session.isSuccess && Boolean(pending),
    retry: 1,
    refetchInterval: (query) =>
      ['completed', 'failed', 'interrupted'].includes(
        query.state.data?.status ?? '',
      )
        ? false
        : query.state.data?.status === 'queued'
          ? 2000
          : query.state.dataUpdateCount < 10 ? 1000 : 2000,
  });

  useEffect(() => {
    if (!chatEnabled || !session.isSuccess || !pendingJobId || typeof EventSource === 'undefined') return;
    const source = new EventSource(`/api/jobs/${encodeURIComponent(pendingJobId)}/events`);
    source.addEventListener('job', event => {
      try {
        const snapshot = JSON.parse((event as MessageEvent<string>).data) as Job;
        if (snapshot.jobId !== pendingJobId) return;
        cache.setQueryData<Job>(['job', pendingJobId], current =>
          current?.updatedAt && snapshot.updatedAt && current.updatedAt > snapshot.updatedAt ? current : snapshot,
        );
        if (['completed', 'failed', 'interrupted'].includes(snapshot.status)) source.close();
      } catch { /* polling remains available for malformed or interrupted streams */ }
    });
    return () => source.close();
  }, [chatEnabled, session.isSuccess, pendingJobId, cache]);

  useEffect(() => {
    const data = job.data;
    if (!pending || !data || data.jobId !== pending.jobId) return;
    if (data.status === 'completed' && data.result?.conversationId) {
      const id = data.result.conversationId;
      setChoices((previous) => ({ ...previous, [pokemonId]: id }));
      void cache.invalidateQueries({ queryKey: ['conversations', pokemonId] });
      // Loading the saved answer must not skip characters still queued for display.
      let cancelled = false;
      void cache.fetchQuery({ queryKey: ['messages', id], queryFn: () => chatApi.messages(id), staleTime: 0 })
        .catch(() => undefined) // History errors use the existing retry UI, without keeping input locked.
        .then(() => {
          if (cancelled) return;
          setHistoryReadyJobId(data.jobId);
        });
      return () => { cancelled = true; };
    } else if (data.status === 'failed' || data.status === 'interrupted') {
      const oldRequest = lastRequests[pokemonId];
      setFailure({
        pokemonId,
        message:
          data.error?.message ?? '작업이 중단되었습니다. 다시 시도해 주세요.',
        retryable: true,
        request: oldRequest
          ? { ...oldRequest, clientRequestId: crypto.randomUUID() }
          : undefined,
      });
      setJobs((previous) => {
        const next = { ...previous };
        delete next[pokemonId];
        return next;
      });
    }
  }, [job.data, pending, pokemonId, cache, lastRequests]);

  useEffect(() => {
    if (!pendingJobId || displayedJobId !== pendingJobId || historyReadyJobId !== pendingJobId) return;
    setJobs(previous => {
      if (previous[pokemonId]?.jobId !== pendingJobId) return previous;
      const next = { ...previous };
      delete next[pokemonId];
      return next;
    });
  }, [pendingJobId, displayedJobId, historyReadyJobId, pokemonId]);

  useEffect(() => {
    if (
      job.error instanceof ApiError &&
      job.error.code === 'RESOURCE_NOT_FOUND' &&
      pending
    ) {
      setFailure({
        pokemonId,
        message:
          '이전 작업을 찾을 수 없습니다. 대화를 확인하고 새로 질문해 주세요.',
        retryable: false,
      });
      setJobs((previous) => {
        const next = { ...previous };
        delete next[pokemonId];
        return next;
      });
    }
  }, [job.error, pending, pokemonId]);

  const createConversation = useMutation({
    mutationFn: (id: string) => chatApi.newConversation(id),
    onSuccess: (data, id) => {
      setChoices((previous) => ({ ...previous, [id]: data.conversationId }));
      setDrafts(previous => ({...previous, [id]: ''}));
      setFailure(null);
      void cache.invalidateQueries({ queryKey: ['conversations', id] });
    },
  });
  const deleteConversation = useMutation({
    mutationFn: chatApi.deleteConversation,
    onSuccess: async (_, id) => {
      await cache.cancelQueries({ queryKey: ['conversations', pokemonId] });
      cache.setQueryData<typeof conversations.data>(['conversations', pokemonId], previous =>
        previous ? { ...previous, items: previous.items.filter(item => item.conversationId !== id), total: Math.max(0, previous.total - 1) } : previous,
      );
      if (id === conversationId) {
        setChoices(previous => ({ ...previous, [pokemonId]: null }));
        setDrafts(previous => ({ ...previous, [pokemonId]: '' }));
        setFailure(null);
      }
      cache.removeQueries({ queryKey: ['messages', id], exact: true });
      await cache.invalidateQueries({ queryKey: ['conversations', pokemonId] });
    },
  });
  const busy = Boolean(pending) || send.isPending || createConversation.isPending || deleteConversation.isPending;
  return {
    session,
    status,
    conversations,
    messages,
    conversationId,
    job,
    pending,
    finishAnswerDisplay: (jobId: string) => setDisplayedJobId(jobId),
    busy,
    createConversation,
    deleteConversation,
    createNew: () => createConversation.mutate(pokemonId),
    failure: failure?.pokemonId === pokemonId ? failure : null,
    draft: drafts[pokemonId] ?? '',
    setDraft: (value: string) =>
      setDrafts((previous) => ({ ...previous, [pokemonId]: value })),
    chooseConversation: (id: string) => {
      setChoices((previous) => ({ ...previous, [pokemonId]: id }));
      setFailure(null);
    },
    canSend: Boolean(
      session.isSuccess &&
        conversations.isSuccess &&
        !messages.isError &&
        !messages.isFetching &&
        !busy,
    ),
    submit: (kind: 'chat' | 'guide', referencePokemonId?: string) =>
      send.mutate({
        pokemonId,
        question: drafts[pokemonId]?.trim() ?? '',
        conversationId,
        kind,
        referencePokemonId,
        clientRequestId: crypto.randomUUID(),
      }),
    retry: () => {
      if (failure?.request) send.mutate(failure.request);
      else {
        void job.refetch();
        void status.refetch();
      }
    },
    refresh: () => {
      void session.refetch();
      void status.refetch();
      void conversations.refetch();
    },
  };
}
