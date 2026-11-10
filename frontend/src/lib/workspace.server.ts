import 'server-only';
import { cookies, headers } from 'next/headers';
import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { Page, Status } from '../types/api';
import type { Conversation, Message } from '../features/chat/types';
import type { SavedTeam } from '../features/team/types';
import { serverRequest } from './serverApi';

// Every render owns its cache. Session data must never enter the public data cache.
export async function getWorkspaceState() {
  const path = (await headers()).get('x-pokesettle-path');
  if (path !== '/chat' && path !== '/scenario') return undefined;
  const client = new QueryClient();
  const sessionCookie = (await cookies()).get('pokecoach_session');
  const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
  const signal = AbortSignal.timeout(8000);
  async function privateRequest<T>(endpoint: string): Promise<T> {
    const response = await fetch(new URL(`/api${endpoint}`, origin), {
      headers: { Cookie: `pokecoach_session=${encodeURIComponent(sessionCookie!.value)}` },
      cache: 'no-store',
      signal,
    });
    if (!response.ok) throw new Error('Workspace initial request failed');
    return (await response.json()).data as T;
  }
  async function readPages<T>(endpoint: string): Promise<Page<T>> {
    const items: T[] = [];
    let offset = 0;
    while (true) {
      const page = await privateRequest<Page<T>>(`${endpoint}?limit=100&offset=${offset}`);
      items.push(...page.items);
      offset += page.items.length;
      if (offset >= page.total || !page.items.length) return { ...page, items, offset: 0 };
    }
  }
  await Promise.allSettled([
    (async () => {
      const status = await serverRequest<Status>('/status');
      if (status) client.setQueryData(['status'], status);
    })(),
    (async () => {
      // New/expired sessions are created by the browser so Set-Cookie reaches it.
      if (!sessionCookie) return;
      if (path === '/scenario') {
        const teams = await privateRequest<{ items: SavedTeam[]; total: number }>('/teams');
        client.setQueryData(['saved-teams'], teams);
      } else {
        const conversations = await readPages<Conversation>('/conversations');
        client.setQueryData(['conversations', 'workspace'], conversations);
        client.setQueryData(['session'], { active: true });
        const id = conversations.items[0]?.conversationId;
        if (id) {
          const messages = await readPages<Message>(`/conversations/${encodeURIComponent(id)}/messages`);
          client.setQueryData(['messages', id], messages.items);
        }
      }
      client.setQueryData(['session'], { active: true });
    })(),
  ]);
  // Failed reads remain absent; existing client error/retry UI handles recovery.
  return dehydrate(client);
}
