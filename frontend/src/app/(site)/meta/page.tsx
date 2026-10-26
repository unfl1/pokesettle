import { Suspense } from 'react';
import MetagamePage from '../../../features/metagame/MetagamePage';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '싱글 메타 순위' };

export default function Page() {
  return <><section className="page-intro" aria-labelledby="page-title"><h1 id="page-title">싱글 메타 순위</h1><p>자주 쓰는 포켓몬과 주요 세팅을 출처·기준일과 함께 살펴보세요.</p></section><Suspense><MetagamePage /></Suspense></>;
}
