import { pageMetadata } from '../../../../i18n/metadata';

import { getI18n } from '../../../../i18n/server';
import { Suspense } from 'react';
import ScenarioWorkspace from '../../../../features/team/components/ScenarioWorkspace';

export default async function Page() {
  const { t: translate } = await getI18n();
  return <><section className="page-intro" aria-labelledby="page-title"><h1 id="page-title">{translate("우리 팀의 가능성을 살펴보세요.")}</h1><p>{translate("양쪽 팀을 구성하고, 선출과 공격·교체 시나리오를 차근차근 비교해 보세요.")}</p></section><Suspense><ScenarioWorkspace /></Suspense></>;
}

export async function generateMetadata() {
  return pageMetadata('/scenario', '6:6 시나리오', '양쪽 팀을 구성하고, 선출과 공격·교체 시나리오를 차근차근 비교해 보세요.');
}
