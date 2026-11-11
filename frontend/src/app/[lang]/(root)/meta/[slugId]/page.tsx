import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getI18n } from '../../../../../i18n/server';
import { defaultLocale, locales, localeRegistry } from '../../../../../i18n/config';
import { siteUrl } from '../../../../../i18n/metadata';
import { routeBySegment } from '../../../../../features/pokemon/route-index.server';
import { pokemonName } from '../../../../../features/pokemon/routing';
import { metagamePath } from '../../../../../features/metagame/routing';
import { getSinglesMeta } from '../../../../../features/metagame/data.server';
import MetagameContent from '../../../../../features/metagame/MetagameContent';

type Props = { params: Promise<{ slugId: string }> };
async function getSelection(params: Props['params']) {
  const { slugId } = await params;
  const entry = routeBySegment(slugId);
  if (!entry) notFound();
  const data = await getSinglesMeta();
  const pokemon = data?.items.find(item => item.pokemonId === entry.pokemonId);
  if (data && !pokemon) notFound();
  // Keep canonical paths consistent with the English slugs used by ranking links.
  return { data, pokemon, entry: pokemon ? { ...pokemon, pokemonId: entry.pokemonId } : entry, slugId };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const { entry } = await getSelection(params);
  const title = `${pokemonName(entry, locale)} | ${t('싱글 메타 순위')} | PokeSettle`;
  const description = t('자주 쓰는 포켓몬과 주요 세팅을 출처·기준일과 함께 살펴보세요.');
  const url = new URL(metagamePath(entry, locale), siteUrl).href;
  const languages = {
    ...Object.fromEntries(locales.map(language => [localeRegistry[language].htmlLang, new URL(metagamePath(entry, language), siteUrl).href])),
    'x-default': new URL(metagamePath(entry, defaultLocale), siteUrl).href,
  };
  return { title: { absolute: title }, description, alternates: { canonical: url, languages }, openGraph: { title, description, url, siteName: 'PokeSettle', type: 'website' } };
}
export default async function Page({ params }: Props) {
  const { locale } = await getI18n();
  const { data, pokemon, entry, slugId } = await getSelection(params);
  const path = metagamePath(entry, locale);
  if (decodeURIComponent(path.split('/').at(-1)!) !== decodeURIComponent(slugId)) redirect(path);
  return <MetagameContent data={data} selected={pokemon?.nameEn} />;
}
