'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { typeLabels } from '../typeNames';
import { typeColorClasses } from '../typeColors';

export type LearnsetGroup = {
  type: string; label: string;
  moves: { name: string; label: string; category: string | null; power: number | null; accuracy: number | null; pp: number | null; effect: { summary: string; description: string | null; language: string; version: string | null } | null; methods: { method: string; label: string }[] }[];
};

function MoveEffect({ effect, sourceLabel }: { effect: LearnsetGroup['moves'][number]['effect']; sourceLabel: string }) {
  if (!effect) return <span className="text-muted">—</span>;
  return <details className="group text-[12px] leading-relaxed text-muted">
    <summary className="flex cursor-pointer list-none items-start gap-1 text-ink [&::-webkit-details-marker]:hidden"><span className="line-clamp-2 group-open:line-clamp-none" >{effect.summary}</span><ChevronDown size={13} className="mt-0.5 shrink-0 group-open:rotate-180" aria-hidden="true" /></summary>
    {effect.description && <p className="mt-2" lang={effect.language}>{effect.description}</p>}
    {effect.version && <p className="mt-1 text-[11px]">{sourceLabel} {effect.version}</p>}
  </details>;
}

export default function LearnsetFilters({ groups, methods }: { groups: LearnsetGroup[]; methods: [string, string][] }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const [chosenType, setType] = useState<string | null>(null);
  const [method, setMethod] = useState('all');
  const [query, setQuery] = useState('');
  const requestedType = params.get('moveType');
  const type = chosenType ?? (requestedType && Object.hasOwn(typeLabels, requestedType) ? requestedType : 'all');
  const rows = groups.flatMap(group => group.moves.map(move => ({ ...move, type: group.type, typeLabel: group.label })))
    .filter(move => (type === 'all' || move.type === type) && (method === 'all' || move.methods.some(entry => entry.method === method)) && move.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const categoryLabels: Record<string, string> = { physical: t('물리'), special: t('특수'), status: t('변화') };
  const categoryColors: Record<string, string> = { physical: 'text-orange-700', special: 'text-sky-700', status: 'text-violet-700' };
  const typeBadge = (value: string, label: string) => <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap ${typeColorClasses(value)}`}>{label}</span>;
  return <section id="pokemon-learnset" className="@container mt-6 mb-4 scroll-mt-28 text-[14px]" data-testid="pokemon-learnset" aria-label={t('배울 수 있는 기술')}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-[16px] font-bold">{t('배울 수 있는 기술')}<span className="ml-2 text-[12px] font-normal text-muted">{t('{count}개', { count: rows.length })}</span></h3>
      {methods.length === 1 && <p className="text-[12px] text-muted">{t('습득 방법')}: {methods[0][1]}</p>}
    </div>
    <div className="my-3 flex flex-wrap gap-2">
      <label className="flex min-w-32 flex-1 items-center gap-2 rounded-lg border border-line px-3 py-2 text-muted focus-within:ring-2 focus-within:ring-accent"><Search size={15} aria-hidden="true" /><span className="sr-only">{t('기술 이름 검색')}</span><input className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('기술 이름 검색')} /></label>
      <select aria-label={t('기술 타입 필터')} value={type} onChange={event => setType(event.target.value)} className="max-w-full rounded-lg border border-line bg-surface px-2 py-2 text-[13px] text-ink">
        <option value="all">{t('전체 타입')}</option>
        {requestedType && Object.hasOwn(typeLabels, requestedType) && !groups.some(group => group.type === requestedType) && <option value={requestedType}>{t(typeLabels[requestedType])}</option>}
        {groups.map(group => <option key={group.type} value={group.type}>{group.label}</option>)}
      </select>
      {methods.length > 1 && <select aria-label={t('기술 습득 방법 필터')} value={method} onChange={event => setMethod(event.target.value)} className="max-w-full rounded-lg border border-line bg-surface px-2 py-2 text-[13px] text-ink"><option value="all">{t('전체 습득 방법')}</option>{methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
    </div>
    <p className="mb-3 text-[11px] leading-relaxed text-muted">{t('PP는 기본값이며, 효과는 원본 게임 자료 기준입니다.')}</p>
    <div className="max-h-[480px] overflow-y-auto rounded-lg border border-line">
      <table className="w-full table-fixed border-collapse text-left text-[13px]" aria-label={t('기술 목록')}>
        <colgroup><col className="@min-[640px]:w-[23%]" /><col className="hidden w-16 @min-[480px]:table-column" /><col className="w-11" /><col className="w-9" /><col className="w-12" /><col className="w-9" /><col className="hidden @min-[640px]:table-column" /></colgroup>
        <thead className="sticky top-0 z-10 bg-canvas text-[12px] text-muted"><tr>
          <th scope="col" className="px-3 py-2.5 font-medium">{t('기술명')}</th><th scope="col" className="hidden px-2 py-2.5 font-medium @min-[480px]:table-cell">{t('타입')}</th><th scope="col" className="px-1 py-2.5 text-center font-medium">{t('분류')}</th><th scope="col" className="px-1 py-2.5 text-right font-medium">{t('위력')}</th><th scope="col" className="px-1 py-2.5 text-right font-medium">{t('명중')}</th><th scope="col" className="px-1 py-2.5 text-right font-medium" title={t('기본 PP')}>PP</th><th scope="col" className="hidden px-3 py-2.5 font-medium @min-[640px]:table-cell">{t('효과')}</th>
        </tr></thead>
        {rows.map(move => <tbody key={`${move.type}-${move.name}`} className="border-t border-line hover:bg-accent-hover">
          <tr data-move-row>
            <th scope="row" className="px-3 py-3 font-medium text-ink wrap-anywhere"><span>{move.label}</span><span className="mt-1 block @min-[480px]:hidden">{typeBadge(move.type, move.typeLabel)}</span>{methods.length > 1 && <span className="mt-1 block text-[11px] font-normal leading-relaxed text-muted">{move.methods.filter(entry => method === 'all' || entry.method === method).map(entry => entry.label).join(' · ')}</span>}</th>
            <td className="hidden px-2 py-3 @min-[480px]:table-cell">{typeBadge(move.type, move.typeLabel)}</td>
            <td className={`px-1 py-3 text-center text-[12px] font-medium ${categoryColors[move.category ?? ''] ?? 'text-muted'}`}>{categoryLabels[move.category ?? ''] ?? '—'}</td>
            <td className="px-1 py-3 text-right font-semibold tabular-nums">{move.power ?? '—'}</td>
            <td className="px-1 py-3 text-right tabular-nums text-muted">{move.accuracy != null ? `${move.accuracy}%` : '—'}</td>
            <td className="px-1 py-3 text-right tabular-nums text-muted">{move.pp ?? '—'}</td>
            <td className="hidden px-3 py-3 @min-[640px]:table-cell"><MoveEffect effect={move.effect} sourceLabel={t('원본 게임:')} /></td>
          </tr>
          <tr className="@min-[640px]:hidden"><td colSpan={5} className="px-3 pb-3 text-[12px]"><span className="mb-1 block text-[11px] text-muted">{t('효과')}</span><MoveEffect effect={move.effect} sourceLabel={t('원본 게임:')} /></td></tr>
        </tbody>)}
      </table>
      {!rows.length && <p role="status" className="px-4 py-8 text-center text-[13px] leading-relaxed text-muted">{type !== 'all' && !groups.some(group => group.type === type) ? t('이 타입의 등록된 기술이 없어요. 다른 포켓몬을 선택해 보세요.') : t('조건에 맞는 기술이 없어요.')}</p>}
    </div>
  </section>;
}
