"use client";
import { referenceName } from '../routing';
import { useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { useTypeLabels } from '../typeLabels';
import { TypeBadge, typeColors } from './TypeBadge';
import { lightTextTypes } from '../typeColors';
import type { PokemonDetail } from '../types';
export default function LearnsetFilters({ pokemon }: { pokemon: Pick<PokemonDetail, 'learnset'> }) {
  const { locale, t: translate } = useI18n();
  const typeLabels = useTypeLabels();
  const [learnMethod, setLearnMethod] = useState('all');
  const [learnType, setLearnType] = useState('all');
  return (
          <div className="mt-4 mb-4 text-[14px]" data-testid="pokemon-learnset">
            <h3 className="font-medium mb-2">{translate("배울 수 있는 기술")}</h3>
            {pokemon.learnset ? <>
              <label className="flex items-center gap-2 mb-3 text-[14px] text-muted">{translate("타입별 보기")} <select aria-label={translate("기술 타입 필터")} value={learnType} onChange={e => setLearnType(e.target.value)} className="rounded-md border border-line bg-canvas px-3 py-2 text-ink">
                  <option value="all">{translate("전체 타입")}</option>
                  {[...new Set(pokemon.learnset.moves.map(m => m.type ?? 'unknown'))].map(type => <option key={type} value={type}>{typeLabels[type] ?? (type === 'unknown' ? translate("타입 미확인") : type)}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-2 mb-3" aria-label={translate("기술 습득 방법 필터")}>
                {Object.entries({ all: translate("전체"), 'level-up': translate("레벨업"), machine: translate("기술머신·비전머신"), egg: translate("알 기술"), tutor: translate("기술 가르침"), train: translate("트레이닝") }).filter(([method]) => method === 'all' || pokemon.learnset!.moves.some(m => m.method === method)).map(([method, label]) => <button key={method} type="button" aria-pressed={learnMethod === method} onClick={() => setLearnMethod(method)} className={`rounded-md border px-3 py-2 text-[14px] ${learnMethod === method ? 'border-line bg-canvas text-ink' : 'border-line text-muted'}`}>{label}</button>)}
              </div>
              <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                {[...Object.keys(typeLabels), 'unknown', ...new Set(pokemon.learnset.moves.map(m => m.type).filter((t): t is string => !!t && !(t in typeLabels)))].map(type => {
                  const moves = pokemon.learnset!.moves.filter(m => (m.type ?? 'unknown') === type && (learnMethod === 'all' || m.method === learnMethod));
                  if (!moves.length || (learnType !== 'all' && learnType !== type)) return null;
                  const unique = [...new Set(moves.map(m => m.name))];
                  return <section key={type} aria-label={translate('{type} 타입 기술', { type: typeLabels[type] ?? (type === 'unknown' ? translate('타입 미확인') : type) })}>
                    <div className="flex items-center gap-2 mb-2"><TypeBadge type={type === 'unknown' ? translate("타입 미확인") : type} /><span className="text-[14px] text-muted">{translate('{count}개', { count: unique.length })}</span></div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-2">
                      {unique.map(name => {
                        const entries = moves.filter(m => m.name === name);
                        const move = entries[0];
                        return <div key={name} className="rounded-lg border border-line border-l-[3px] bg-canvas px-3 py-2.5" style={{ borderLeftColor: typeColors[type] ?? '#8492a3' }}>
                          <div className="flex items-center justify-between gap-2"><strong className="text-[14px] font-medium text-ink">{referenceName(move, locale)}</strong><span className={`shrink-0 rounded px-1.5 py-0.5 text-[14px] font-medium ${{ physical: 'bg-orange-400/15 text-orange-700', special: 'bg-sky-400/15 text-sky-700', status: 'bg-violet-400/15 text-violet-700' }[move.category ?? ''] ?? 'text-slate-600'}`}>{{ physical: translate("물리"), special: translate("특수"), status: translate("변화") }[move.category ?? ''] ?? translate("분류 미확인")}</span></div>
                          <div className="mt-2 flex items-center gap-2 whitespace-nowrap text-[14px]">
                            <p className="inline-flex items-center gap-1 rounded px-2 py-1" style={{ backgroundColor: typeColors[type] ?? '#8492a3', color: lightTextTypes.has(type) ? '#ffffff' : '#111923' }}><span>{translate("위력")}</span> <strong className="font-semibold tabular-nums">{move.power ?? '—'}</strong></p>
                            <p className="inline-flex items-center gap-1 rounded bg-line px-2 py-1 text-muted"><span>{translate("명중")}</span> <strong className="font-semibold tabular-nums">{move.accuracy != null ? `${move.accuracy}%` : '—'}</strong></p>
                          </div>
                          <p className="text-[14px] text-muted mt-1">{entries.map(m => m.method === 'level-up' ? translate('레벨업 Lv.{level}', { level: m.level ?? '—' }) : ({ machine: translate("기술머신·비전머신"), egg: translate("알 기술"), tutor: translate("기술 가르침"), train: translate("트레이닝") }[m.method] ?? m.method)).join(' · ')}</p>
                        </div>;
                      })}
                    </div>
                  </section>;
                })}
              </div>
            </> : <p className="text-muted">{translate("이 포켓몬의 버전별 기술 습득 자료가 아직 등록되지 않았습니다.")}</p>}
          </div>
  );
}
