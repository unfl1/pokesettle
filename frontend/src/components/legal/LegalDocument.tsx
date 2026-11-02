import type { ReactNode } from 'react';

export type LegalSection = { id: string; title: string; content: ReactNode };

export default function LegalDocument({ title, summary, sections, related }: {
  title: string;
  summary: string;
  sections: LegalSection[];
  related: { href: string; label: string };
}) {
  return <article className="legal-document">
    <header className="legal-intro"><p className="legal-eyebrow">POKESETTLE</p><h1>{title}</h1><p>{summary}</p><p className="legal-date">시행일 <time dateTime="2026-11-02">2026년 11월 2일</time></p></header>
    <div className="legal-grid">
      <aside><nav aria-label="목차"><h2>목차</h2><ol>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav></aside>
      <div className="legal-body">{sections.map(section => <section key={section.id} id={section.id}><h2>{section.title}</h2>{section.content}</section>)}
        <div className="legal-related"><a href={related.href}>{related.label} →</a><a href="https://github.com/unfl1/pokesettle/issues">문의하기 ↗</a></div>
      </div>
    </div>
  </article>;
}
