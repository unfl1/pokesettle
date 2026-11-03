import { serverRequest } from '../../../../lib/serverApi';
import type { SinglesMeta } from '../../../../features/metagame/types';
import { pageMetadata } from '../../../../i18n/metadata';

import { getI18n } from '../../../../i18n/server';
import SourceLanguageNote from '../../../../components/layout/SourceLanguageNote';
import MetagamePage from '../../../../features/metagame/MetagamePage';

export default async function Page({ searchParams }: PageProps<'/[lang]/meta'>) {
  const { pokemon } = await searchParams;
  const { t: translate } = await getI18n();
  let initialData = await serverRequest<SinglesMeta>('/meta/singles').catch(() => null);
  if (initialData) {
    // Preserve the backend's 6h freshness / 24h expiry even if revalidation fails.
    const age = Date.now() - Date.parse(initialData.collectedAt);
    if (!Number.isFinite(age) || age >= 24 * 60 * 60 * 1000) initialData = null;
    else if (age >= 6 * 60 * 60 * 1000) initialData = { ...initialData, stale: true };
  }
  return <><section className="page-intro" aria-labelledby="page-title"><h1 id="page-title">{translate("싱글 메타 순위")}</h1><p>{translate("자주 쓰는 포켓몬과 주요 세팅을 출처·기준일과 함께 살펴보세요.")}</p></section><MetagamePage data={initialData} selected={typeof pokemon === 'string' ? pokemon : undefined} /><SourceLanguageNote /></>;
}

export async function generateMetadata() {
  return pageMetadata('/meta', '싱글 메타 순위', '자주 쓰는 포켓몬과 주요 세팅을 출처·기준일과 함께 살펴보세요.');
}
