import { serverRequest } from '../../../../lib/serverApi';
import PokedexPage from '../../../../features/pokemon/pages/PokedexPage';
import type { PokemonSummary } from '../../../../features/pokemon/types';
import type { Page } from '../../../../types/api';
import type { ReactNode } from 'react';
import RouteBoundary from '../../../../components/layout/RouteBoundary';

async function PokedexContent({ children }: { children: ReactNode }) {
  const initialPage = await serverRequest<Page<PokemonSummary>>('/pokemon?limit=100&offset=0').catch(() => null);
  return <PokedexPage initialPage={initialPage}>{children}</PokedexPage>;
}

export default function PokedexLayout({ children }: { children: ReactNode }) {
  return <RouteBoundary><PokedexContent>{children}</PokedexContent></RouteBoundary>;
}
