import Link from 'next/link';
import { getI18n } from '../../../../../i18n/server';
import { localizedPath } from '../../../../../i18n/config';
export default async function NotFound() {
  const { locale, t } = await getI18n();
  return <section><h1>{t('포켓몬을 찾을 수 없습니다.')}</h1><Link href={localizedPath(locale, '/pokedex')}>{t('도감')}</Link></section>;
}
