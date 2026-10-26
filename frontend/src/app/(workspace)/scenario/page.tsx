import { Suspense } from 'react';
import ScenarioWorkspace from '../../ScenarioWorkspace';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '6:6 시나리오' };

export default function Page() {
  return <><section className="page-intro" aria-labelledby="page-title"><h1 id="page-title">우리 팀의 가능성을 살펴보세요.</h1><p>양쪽 팀을 구성하고, 선출과 공격·교체 시나리오를 차근차근 비교해 보세요.</p></section><Suspense><ScenarioWorkspace /></Suspense></>;
}
