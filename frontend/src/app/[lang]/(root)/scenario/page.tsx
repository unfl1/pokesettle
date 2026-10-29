import { pageMetadata } from '../../../../i18n/metadata';

import { getI18n } from '../../../../i18n/server';
import { Suspense } from 'react';
import ScenarioWorkspace from '../../../../features/team/components/ScenarioWorkspace';

export default async function Page() {
  const { t: translate } = await getI18n();
  return <><section className="page-intro" aria-labelledby="page-title"><h1 id="page-title">{translate("누구를 내보낼지, 먼저 골라보세요")}</h1><p>{translate("양쪽 팀을 추가하면 추천 3마리와 선봉을 확인할 수 있어요.")}</p></section><Suspense><ScenarioWorkspace /></Suspense></>;
}

export async function generateMetadata() {
  return pageMetadata('/scenario', '6:6 시나리오', '양쪽 팀을 구성하고, 선출과 공격·교체 시나리오를 차근차근 비교해 보세요.');
}
