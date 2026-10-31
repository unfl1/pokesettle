import { getI18n } from '../../i18n/server';

export default async function RouteLoading() {
  const { t } = await getI18n();
  return <section className="route-loading" role="status" aria-live="polite" aria-busy="true">
    <p>{t('화면을 불러오는 중…')}</p>
    <div className="route-loading-skeleton" aria-hidden="true"><span /><span /><span /></div>
  </section>;
}
