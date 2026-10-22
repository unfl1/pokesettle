import { post, request } from '../../lib/apiClient';
import type { SavedTeam, TeamMember } from './types';

export const battleApi = {
  teams: () => request<{ items: SavedTeam[]; total: number }>('/teams'),
  save: (name: string, members: TeamMember[], id?: string) =>
    request<SavedTeam>(id ? `/teams/${id}` : '/teams', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ name, members }),
    }),
  remove: (id: string) => request<void>(`/teams/${id}`, { method: 'DELETE' }),
  analyze: <T>(path: string, payload: unknown) => post<T>(path, payload),
};
