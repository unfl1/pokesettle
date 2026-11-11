import { redirect } from 'next/navigation';
import { pageMetadata } from '../../../../i18n/metadata';
import { getI18n } from '../../../../i18n/server';
import { getSinglesMeta } from '../../../../features/metagame/data.server';
import { metagameSelectionPath } from '../../../../features/metagame/routing';
import MetagameContent from '../../../../features/metagame/MetagameContent';

export default async function Page({ searchParams }: PageProps<'/[lang]/meta'>) {
  const { pokemon } = await searchParams;
  const { locale } = await getI18n();
  const data = await getSinglesMeta();
  const selected = typeof pokemon === 'string' ? pokemon : undefined;
  const item = data?.items.find(item => item.nameEn === selected);
  if (item?.pokemonId) redirect(metagameSelectionPath(item, locale));
  return <MetagameContent data={data} selected={selected} />;
}

export async function generateMetadata() {
  return pageMetadata('/meta', '싱글 메타 순위', '자주 쓰는 포켓몬과 주요 세팅을 출처·기준일과 함께 살펴보세요.');
}
