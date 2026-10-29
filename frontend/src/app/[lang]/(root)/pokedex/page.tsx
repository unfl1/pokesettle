import { pageMetadata } from '../../../../i18n/metadata';
import { getI18n, getDictionary } from '../../../../i18n/server';
import { serverRequest } from '../../../../lib/serverApi';
import { PokemonProfile } from '../../../../features/pokemon/components/PokemonProfile';
import type { PokemonDetail } from '../../../../features/pokemon/types';
export default async function Page() {
  const { locale, t } = await getI18n();
  const pokemon = await serverRequest<PokemonDetail>('/pokemon/pokemon%3A25');
  return pokemon ? <PokemonProfile pokemon={pokemon} locale={locale} dictionary={await getDictionary(locale)} /> : <p role="alert">{t('포켓몬 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')}</p>;
}
export async function generateMetadata() { return pageMetadata('/pokedex', '도감', '포켓몬의 타입·특성·종족값과 기술을 확인하세요.'); }
