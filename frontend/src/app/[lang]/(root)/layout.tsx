import type { ReactNode } from 'react';
import WorkspaceShell from '../../../components/layout/WorkspaceShell';
import KantoCollection from '../../../features/collection/KantoCollection';
import { routeEntries } from '../../../features/pokemon/route-index.server';
import { pokemonName } from '../../../features/pokemon/routing';
import { getI18n } from '../../../i18n/server';

export default async function RootGroupLayout({ children }: { children: ReactNode }) {
  const { locale } = await getI18n();
  const pokemon = routeEntries
    .map(entry => ({ id: Number(entry.pokemonId.split(':')[1]), name: pokemonName(entry, locale) }))
    .filter(entry => entry.id >= 1 && entry.id <= 151)
    .sort((a, b) => a.id - b.id);
  return <WorkspaceShell collection={<KantoCollection pokemon={pokemon} />}>{children}</WorkspaceShell>;
}
