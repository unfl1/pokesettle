import type {
  Conversation,
  DiscoveryResult,
  GroundedResult,
  Job,
  Message,
  Page,
  PokemonDetail,
  PokemonSummary,
  Status,
} from '../types';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
  } catch {
    throw new ApiError(
      'CONNECTION_FAILED',
      '서버에 연결할 수 없습니다. 연결 상태를 확인하고 다시 시도해 주세요.',
      true,
    );
  }
  if (response.status === 204) return undefined as T;
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      '서버 응답을 읽을 수 없습니다.',
      true,
    );
  }
  if (!response.ok)
    throw new ApiError(
      body.error?.code ?? 'SERVER_ERROR',
      body.error?.message ?? '요청을 처리하지 못했습니다.',
      body.error?.retryable ?? false,
    );
  return body.data as T;
}

export const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const api = {
  status: () => request<Status>('/status'),
  session: () => post<{ active: boolean }>('/session', {}),
  pokemon: (q = '', offset = 0) =>
    request<Page<PokemonSummary>>(
      `/pokemon?limit=100&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),
  detail: (id: string) =>
    request<PokemonDetail>(`/pokemon/${encodeURIComponent(id)}`),
  conversations: (id: string) =>
    request<Page<Conversation>>(
      `/conversations?pokemonId=${encodeURIComponent(id)}&limit=100`,
    ),
  messages: async (id: string): Promise<Message[]> => {
    const items: Message[] = [];
    let offset = 0;
    do {
      const page = await request<Page<Message>>(
        `/conversations/${encodeURIComponent(id)}/messages?limit=100&offset=${offset}`,
      );
      items.push(...page.items);
      offset += page.items.length;
      if (offset >= page.total || !page.items.length) return items;
    } while (true);
  },
  newConversation: (pokemonId: string) =>
    post<{ conversationId: string }>('/conversations', { pokemonId }),
  discover: (query: string, offset = 0) =>
    post<DiscoveryResult>('/pokemon/search', { query, limit: 100, offset }),
  chat: (
    pokemonId: string,
    question: string,
    conversationId: string | null,
    clientRequestId: string,
  ) =>
    post<{ jobId: string }>('/chat', {
      pokemonId,
      question,
      conversationId,
      clientRequestId,
    }),
  guide: (
    pokemonId: string,
    conversationId: string | null,
    clientRequestId: string,
  ) =>
    post<{ jobId: string }>(`/pokemon/${encodeURIComponent(pokemonId)}/guide`, {
      conversationId,
      clientRequestId,
    }),
  job: (id: string) => request<Job>(`/jobs/${encodeURIComponent(id)}`),
};
export const asGrounded = (message: Message): GroundedResult | null =>
  typeof message.content === 'object' ? message.content : null;
