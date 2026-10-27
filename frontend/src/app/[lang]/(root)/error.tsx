"use client";
import { useI18n } from '../../../i18n/I18nProvider';

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t: translate } = useI18n();
  return <section className="notice" role="alert">
    <p>{translate("화면을 불러오지 못했어요. 다시 시도해 주세요.")}</p>
    <button onClick={reset}>{translate("다시 시도")}</button>
  </section>;
}
