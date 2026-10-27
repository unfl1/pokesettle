import { pageMetadata } from '../../../../i18n/metadata';

import { getI18n } from '../../../../i18n/server';
import { Suspense } from 'react';
import MetagamePage from '../../../../features/metagame/MetagamePage';

export default async function Page() {
  const { t: translate } = await getI18n();
  return <><section className="page-intro" aria-labelledby="page-title"><h1 id="page-title">{translate("싱글 메타 순위")}</h1><p>{translate("자주 쓰는 포켓몬과 주요 세팅을 출처·기준일과 함께 살펴보세요.")}</p></section><Suspense><MetagamePage /></Suspense></>;
}

export async function generateMetadata() {
  return pageMetadata('/meta', '싱글 메타 순위', '자주 쓰는 포켓몬과 주요 세팅을 출처·기준일과 함께 살펴보세요.');
}
