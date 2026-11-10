import type { Locale } from '../../i18n/config';
import { getLegalTranslator } from './copy.server';
import type { ReactNode } from 'react';

export type LegalSection = { id: string; title: string; content: ReactNode };

export default async function LegalDocument({ locale, title, summary, sections, related }: {
  locale: Locale;
  title: string;
  summary: string;
  sections: LegalSection[];
  related: { href: string; label: string };
}) {
  const t = await getLegalTranslator(locale);
  return <article className="legal-document max-w-270 mx-auto [padding:64px_24px_80px] screen-760:[padding:40px_20px_56px]">
    <header className="legal-intro [&_h1]:[margin:12px_0_20px] [&_h1]:text-[30px] [&_h1]:font-[750] [&_h1]:tracking-[-1.1px] [&_h1]:leading-[1.4] [&_>_p]:leading-[1.8] [&_>_p]:text-muted [&_>_p:not(.legal-date)]:text-[14px] [&_.legal-date]:inline-block [&_.legal-date]:mt-6 [&_.legal-date]:py-1.75 [&_.legal-date]:px-3.5 [&_.legal-date]:rounded-[24px] [&_.legal-date]:bg-accent-soft [&_.legal-date]:text-accent-strong [&_.legal-date]:text-[13px] max-tablet:[&_h1]:text-[26px] screen-540:[&_h1]:text-[24px] screen-540:[&_h1]:tracking-[-.9px]"><h1>{title}</h1><p>{summary}</p><p className="legal-date">{t('시행일')} <time dateTime="2026-11-02">{t('2026년 11월 2일')}</time></p></header>
    <div className="legal-grid grid grid-cols-[210px_minmax(0,_1fr)] gap-14 mt-13 [&_aside_nav]:sticky [&_aside_nav]:top-8 [&_aside_h2]:[margin:0_0_16px] [&_aside_h2]:text-[13px] [&_aside_h2]:text-muted [&_aside_h2]:font-bold [&_aside_ol]:list-none [&_aside_ol]:m-0 [&_aside_ol]:p-0 [&_aside_a]:block [&_aside_a]:[padding:8px_0] [&_aside_a]:text-[13px] [&_aside_a]:leading-[1.6] [&_aside_a:hover]:text-accent screen-760:grid-cols-[minmax(0,_1fr)] screen-760:gap-8 screen-760:mt-8 screen-760:[&_aside_nav]:static screen-760:[&_aside_nav]:p-5 screen-760:[&_aside_nav]:bg-canvas screen-760:[&_aside_nav]:rounded-[16px]">
      <aside><nav aria-label={t('목차')}><h2>{t('목차')}</h2><ol>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav></aside>
      <div className="legal-body min-w-0 wrap-anywhere break-keep [&_section]:scroll-mt-[32px] [&_section]:[padding:28px_0] [&_section]:[border-top:1px_solid_var(--color-line)] [&_section:first-child]:pt-0 [&_section:first-child]:[border-top:0] [&_h2]:[margin:0_0_18px] [&_h2]:text-[20px] [&_h2]:font-bold [&_p]:text-[15px] [&_p]:leading-[1.9] [&_p]:text-ink [&_p]:[margin:12px_0] [&_li]:text-[15px] [&_li]:leading-[1.9] [&_li]:text-ink [&_li]:[margin:8px_0] [&_ul]:list-disc [&_ul]:pl-5.5 [&_a]:text-accent-strong [&_a]:underline [&_a]:underline-offset-[3px] screen-760:[&_h2]:text-[18px]">{sections.map(section => <section key={section.id} id={section.id}><h2>{section.title}</h2>{section.content}</section>)}
        <div className="legal-related flex flex-wrap [gap:16px_28px] mt-7 p-6 rounded-[16px] bg-canvas text-[14px]"><a href={related.href}>{related.label} →</a><a href="https://github.com/unfl1/pokesettle/issues">{t('문의하기')} ↗</a></div>
      </div>
    </div>
  </article>;
}
