import { post, request } from '../../lib/apiClient';
import type { Page } from '../../types/api';
import type { Conversation, GroundedResult, Job, Message } from './types';

export const chatApi = {
  conversations: async (_id?: string): Promise<Page<Conversation>> => {
    const items: Conversation[] = [];
    let offset = 0;
    while (true) {
      const page = await request<Page<Conversation>>(`/conversations?limit=100&offset=${offset}`);
      items.push(...page.items);
      offset += page.items.length;
      if (offset >= page.total || !page.items.length) return {...page, items, offset: 0};
    }
  },
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
  newConversation: (_id?: string) =>
    post<{ conversationId: string }>('/conversations', {}),
  deleteConversation: (id: string) =>
    request<void>(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  chat: (
    pokemonId: string,
    question: string,
    conversationId: string | null,
    clientRequestId: string,
  ) =>
    post<{ jobId: string }>('/chat', {
      pokemonId: pokemonId === 'workspace' ? undefined : pokemonId,
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
