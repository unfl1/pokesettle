"use client";
import { useI18n } from '../../../i18n/I18nProvider';

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t: translate } = useI18n();
  return <section className="notice flex items-center gap-3 py-3.75 px-4.5 mb-5 bg-warning-soft [border:1px_solid_var(--color-warning-line)] rounded-[10px] text-[14px] text-warning leading-[1.8] [&_button]:ml-auto [&_button]:whitespace-nowrap [&_button]:font-semibold screen-540:p-3 screen-540:text-[14px] screen-540:gap-[9px]" role="alert">
    <p>{translate("화면을 불러오지 못했어요. 다시 시도해 주세요.")}</p>
    <button onClick={reset}>{translate("다시 시도")}</button>
  </section>;
}
