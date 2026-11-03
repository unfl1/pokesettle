import type { ReactNode } from 'react';

export type LegalSection = { id: string; title: string; content: ReactNode };

export default function LegalDocument({ title, summary, sections, related }: {
  title: string;
  summary: string;
  sections: LegalSection[];
  related: { href: string; label: string };
}) {
  return <article className="legal-document max-w-270 [margin:0_auto] [padding:64px_24px_80px] screen-760:[padding:40px_20px_56px]">
    <header className="legal-intro [&_h1]:[margin:12px_0_20px] [&_h1]:text-[30px] [&_h1]:font-[750] [&_h1]:tracking-[-1.1px] [&_h1]:leading-[1.4] [&_>_p]:leading-[1.8] [&_>_p]:text-[#64748b] [&_>_p:not(.legal-date)]:text-[14px] [&_.legal-date]:inline-block [&_.legal-date]:mt-6 [&_.legal-date]:py-1.75 [&_.legal-date]:px-3.5 [&_.legal-date]:rounded-[24px] [&_.legal-date]:bg-[#e6efff] [&_.legal-date]:text-[#0041cc] [&_.legal-date]:text-[13px] screen-780:[&_h1]:text-[26px] screen-540:[&_h1]:text-[24px] screen-540:[&_h1]:tracking-[-.9px]"><h1>{title}</h1><p>{summary}</p><p className="legal-date">시행일 <time dateTime="2026-11-02">2026년 11월 2일</time></p></header>
    <div className="legal-grid grid grid-cols-[210px_minmax(0,_1fr)] gap-14 mt-13 [&_aside_nav]:sticky [&_aside_nav]:top-8 [&_aside_h2]:[margin:0_0_16px] [&_aside_h2]:text-[13px] [&_aside_h2]:text-[#64748b] [&_aside_h2]:font-bold [&_aside_ol]:list-none [&_aside_ol]:m-0 [&_aside_ol]:p-0 [&_aside_a]:block [&_aside_a]:[padding:8px_0] [&_aside_a]:text-[13px] [&_aside_a]:leading-[1.6] [&_aside_a:hover]:text-[#0057ff] screen-760:grid-cols-[minmax(0,_1fr)] screen-760:gap-8 screen-760:mt-8 screen-760:[&_aside_nav]:static screen-760:[&_aside_nav]:p-5 screen-760:[&_aside_nav]:bg-[#f5f6f8] screen-760:[&_aside_nav]:rounded-[16px]">
      <aside><nav aria-label="목차"><h2>목차</h2><ol>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav></aside>
      <div className="legal-body min-w-0 wrap-anywhere break-keep [&_section]:scroll-mt-[32px] [&_section]:[padding:28px_0] [&_section]:[border-top:1px_solid_#e1e4e8] [&_section:first-child]:pt-0 [&_section:first-child]:[border-top:0] [&_h2]:[margin:0_0_18px] [&_h2]:text-[20px] [&_h2]:font-bold [&_p]:text-[15px] [&_p]:leading-[1.9] [&_p]:text-[#475569] [&_p]:[margin:12px_0] [&_li]:text-[15px] [&_li]:leading-[1.9] [&_li]:text-[#475569] [&_li]:[margin:8px_0] [&_ul]:list-disc [&_ul]:pl-5.5 [&_a]:text-[#0041cc] [&_a]:underline [&_a]:underline-offset-[3px] screen-760:[&_h2]:text-[18px]">{sections.map(section => <section key={section.id} id={section.id}><h2>{section.title}</h2>{section.content}</section>)}
        <div className="legal-related flex flex-wrap [gap:16px_28px] mt-7 p-6 rounded-[16px] bg-[#f5f6f8] text-[14px]"><a href={related.href}>{related.label} →</a><a href="https://github.com/unfl1/pokesettle/issues">문의하기 ↗</a></div>
      </div>
    </div>
  </article>;
}
