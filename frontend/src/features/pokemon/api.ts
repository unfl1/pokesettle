import { post, request } from '../../lib/apiClient';
import type { Page } from '../../types/api';
import type { DiscoveryResult, PokemonDetail, PokemonSummary } from './types';

export const pokemonApi = {
  pokemon: (q = '', offset = 0) =>
    request<Page<PokemonSummary>>(
      `/pokemon?limit=100&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),
  detail: (id: string) =>
    request<PokemonDetail>(`/pokemon/${encodeURIComponent(id)}`),
  discover: (query: string, offset = 0) =>
    post<DiscoveryResult>('/pokemon/search', { query, limit: 100, offset }),
};
