import { getI18n } from '../../i18n/server';

export default async function RouteLoading({ description }: { description?: string } = {}) {
  const { t } = await getI18n();
  return <section className="route-loading min-h-60 [padding:32px_0] text-muted" role="status" aria-live="polite" aria-busy="true">
    <p>{t('화면을 불러오는 중…')}</p>
    {description && <p className="mt-2 text-[14px]">{description}</p>}
    <div className="route-loading-skeleton grid gap-4 mt-6 [&_span]:block [&_span]:h-10 [&_span]:rounded-[12px] [&_span]:bg-accent-hover [&_span:last-child]:w-[65%]" aria-hidden="true"><span /><span /><span /></div>
  </section>;
}
