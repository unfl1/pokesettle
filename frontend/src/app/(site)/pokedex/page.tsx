import { Suspense } from 'react';
import PokedexPage from '../../../features/pokemon/pages/PokedexPage';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '도감' };

export default function Page() {
  return <><section className="page-intro" aria-labelledby="page-title"><h1 id="page-title">도감</h1><p>포켓몬의 타입·특성·종족값과 기술을 확인하세요.</p></section><Suspense><PokedexPage /></Suspense></>;
}
