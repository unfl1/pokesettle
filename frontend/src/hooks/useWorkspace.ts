import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import type { PendingJob } from '../types';

interface SendRequest {
  pokemonId: string;
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

export function useWorkspace(pokemonId: string) {
  const cache = useQueryClient();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: api.session,
    staleTime: Infinity,
    retry: false,
  });
  const status = useQuery({
    queryKey: ['status'],
    queryFn: api.status,
    refetchInterval: 15000,
  });
  const detail = useQuery({
    queryKey: ['detail', pokemonId],
    queryFn: () => api.detail(pokemonId),
  });
  const conversations = useQuery({
    queryKey: ['conversations', pokemonId],
    queryFn: () => api.conversations(pokemonId),
    enabled: session.isSuccess,
  });
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const conversationId = Object.hasOwn(choices, pokemonId)
    ? choices[pokemonId]
    : (conversations.data?.items[0]?.conversationId ?? null);
  const messages = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.messages(conversationId!),
    enabled: session.isSuccess && Boolean(conversationId),
  });
  const [jobs, setJobs] = useState(readPending);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [lastRequests, setLastRequests] = useState<Record<string, SendRequest>>(
    {},
  );
  const pending = jobs[pokemonId];

  useEffect(() => {
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
  }, [jobs]);

  const send = useMutation({
    mutationFn: (body: SendRequest) =>
      body.kind === 'guide'
        ? api.guide(body.pokemonId, body.conversationId, body.clientRequestId)
        : api.chat(
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
    queryFn: () => api.job(pending!.jobId),
    enabled: session.isSuccess && Boolean(pending),
    retry: 1,
    refetchInterval: (query) =>
      ['completed', 'failed', 'interrupted'].includes(
        query.state.data?.status ?? '',
      )
        ? false
        : 600,
  });

  useEffect(() => {
    const data = job.data;
    if (!pending || !data || data.jobId !== pending.jobId) return;
    if (data.status === 'completed' && data.result?.conversationId) {
      const id = data.result.conversationId;
      setChoices((previous) => ({ ...previous, [pokemonId]: id }));
      void cache.invalidateQueries({ queryKey: ['conversations', pokemonId] });
      void cache.invalidateQueries({ queryKey: ['messages', id] });
      setJobs((previous) => {
        const next = { ...previous };
        delete next[pokemonId];
        return next;
      });
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
    mutationFn: (id: string) => api.newConversation(id),
    onSuccess: (data, id) => {
      setChoices((previous) => ({ ...previous, [id]: data.conversationId }));
      void cache.invalidateQueries({ queryKey: ['conversations', id] });
    },
  });
  const busy = Boolean(pending) || send.isPending;
  return {
    session,
    status,
    detail,
    conversations,
    messages,
    conversationId,
    job,
    pending,
    busy,
    createConversation,
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
        status.data?.ready &&
        detail.data &&
        conversations.isSuccess &&
        !messages.isError &&
        !messages.isFetching &&
        !busy,
    ),
    submit: (kind: 'chat' | 'guide') =>
      send.mutate({
        pokemonId,
        question: drafts[pokemonId]?.trim() ?? '',
        conversationId,
        kind,
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
