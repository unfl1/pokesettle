'use client';

import { useState, type ReactNode } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';

export type LearnsetGroup = {
  type: string; label: string; borderClass: string; badge: ReactNode;
  moves: { name: string; content: ReactNode; methods: { method: string; label: string }[] }[];
};

export default function LearnsetFilters({ groups, methods }: { groups: LearnsetGroup[]; methods: [string, string][] }) {
  const { t } = useI18n();
  const [learnMethod, setLearnMethod] = useState('all');
  const [learnType, setLearnType] = useState('all');
  return <div className="mt-4 mb-4 text-[14px]" data-testid="pokemon-learnset">
    <h3 className="font-medium mb-2">{t('배울 수 있는 기술')}</h3>
    <label className="flex items-center gap-2 mb-3 text-[14px] text-muted">{t('타입별 보기')} <select aria-label={t('기술 타입 필터')} value={learnType} onChange={event => setLearnType(event.target.value)} className="rounded-md border border-line bg-canvas px-3 py-2 text-ink">
      <option value="all">{t('전체 타입')}</option>
      {groups.map(group => <option key={group.type} value={group.type}>{group.label}</option>)}
    </select></label>
    <div className="flex flex-wrap gap-2 mb-3" aria-label={t('기술 습득 방법 필터')}>
      {[["all", t('전체')], ...methods].map(([method, label]) => <button key={method} type="button" aria-pressed={learnMethod === method} onClick={() => setLearnMethod(method)} className={`rounded-md border px-3 py-2 text-[14px] ${learnMethod === method ? 'border-line bg-canvas text-ink' : 'border-line text-muted'}`}>{label}</button>)}
    </div>
    <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
      {groups.map(group => {
        const moves = group.moves.filter(move => learnMethod === 'all' || move.methods.some(entry => entry.method === learnMethod));
        if (!moves.length || (learnType !== 'all' && learnType !== group.type)) return null;
        return <section key={group.type} aria-label={t('{type} 타입 기술', { type: group.label })}>
          <div className="flex items-center gap-2 mb-2">{group.badge}<span className="text-[14px] text-muted">{t('{count}개', { count: moves.length })}</span></div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-2">
            {moves.map(move => <div key={move.name} className={`rounded-lg border border-line border-l-[3px] bg-canvas px-3 py-2.5 ${group.borderClass}`}>
              {move.content}
              <p className="text-[14px] text-muted mt-1">{move.methods.filter(entry => learnMethod === 'all' || entry.method === learnMethod).map(entry => entry.label).join(' · ')}</p>
            </div>)}
          </div>
        </section>;
      })}
    </div>
  </div>;
}
