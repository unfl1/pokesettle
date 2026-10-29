'use client';
import { useI18n } from '../../../../i18n/I18nProvider';
export default function Error({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return <section role="alert" className="rounded-xl border border-line bg-surface p-6"><p>{t('포켓몬 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')}</p><button className="mt-4 text-accent" onClick={reset}>{t('다시 시도')}</button></section>;
}
