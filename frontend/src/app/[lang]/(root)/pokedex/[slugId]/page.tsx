import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getI18n, getDictionary } from '../../../../../i18n/server';
import { siteUrl } from '../../../../../i18n/metadata';
import { serverRequest } from '../../../../../lib/serverApi';
import { routeById, pokemonAlternates } from '../../../../../features/pokemon/route-index.server';
import { idFromSegment, pokemonName, pokemonPath } from '../../../../../features/pokemon/routing';
import { PokemonProfile } from '../../../../../features/pokemon/components/PokemonProfile';
import type { PokemonDetail } from '../../../../../features/pokemon/types';
type Props = { params: Promise<{ slugId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const entry = routeById(idFromSegment((await params).slugId) ?? '');
  if (!entry) notFound();
  const name = pokemonName(entry, locale), title = `${name} | ${t('도감')} | PokeSettle`;
  const description = t('{name}의 타입·특성·종족값과 기술을 확인하세요.', { name });
  const url = new URL(pokemonPath(entry, locale), siteUrl).href;
  return { title: { absolute: title }, description, alternates: { canonical: url, languages: pokemonAlternates(entry) }, openGraph: { title, description, url, siteName: 'PokeSettle', type: 'website' } };
}
export default async function Page({ params }: Props) {
  const { locale } = await getI18n();
  const entry = routeById(idFromSegment((await params).slugId) ?? '');
  if (!entry) notFound();
  const pokemon = await serverRequest<PokemonDetail>(`/pokemon/${encodeURIComponent(entry.pokemonId)}`);
  if (!pokemon) notFound();
  return <PokemonProfile headingLevel={1} key={entry.pokemonId} pokemon={pokemon} locale={locale} dictionary={await getDictionary(locale)} />;
}
