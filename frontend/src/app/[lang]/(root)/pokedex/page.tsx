import { pageMetadata } from '../../../../i18n/metadata';

import { getI18n } from '../../../../i18n/server';
import { Suspense } from 'react';
import PokedexPage from '../../../../features/pokemon/pages/PokedexPage';

export default async function Page() {
  const { t: translate } = await getI18n();
  return <><section className="page-intro" aria-labelledby="page-title"><h1 id="page-title">{translate("도감")}</h1><p>{translate("포켓몬의 타입·특성·종족값과 기술을 확인하세요.")}</p></section><Suspense><PokedexPage /></Suspense></>;
}

export async function generateMetadata() {
  return pageMetadata('/pokedex', '도감', '포켓몬의 타입·특성·종족값과 기술을 확인하세요.');
}
