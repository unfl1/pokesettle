import 'server-only';
import type { Locale } from '../../../i18n/config';
import { createTranslator, type Dictionary } from '../../../i18n/translate';
import { referenceName } from '../routing';
import { typeLabels } from '../typeNames';
import { typeColors, lightTextTypes } from '../typeColors';
import type { PokemonDetail } from '../types';
import LearnsetFilters, { type LearnsetGroup } from './LearnsetFilters';

export default function Learnset({ pokemon, locale, dictionary }: { pokemon: Pick<PokemonDetail, 'learnset'>; locale: Locale; dictionary: Dictionary }) {
  const t = createTranslator(dictionary);
  const learnset = pokemon.learnset;
  if (!learnset) return <div className="mt-4 mb-4 text-[14px]" data-testid="pokemon-learnset"><h3 className="font-medium mb-2">{t('배울 수 있는 기술')}</h3><p className="text-muted">{t('이 포켓몬의 버전별 기술 습득 자료가 아직 등록되지 않았습니다.')}</p></div>;
  const methodLabels: Record<string, string> = { 'level-up': t('레벨업'), machine: t('기술머신·비전머신'), egg: t('알 기술'), tutor: t('기술 가르침'), train: t('트레이닝') };
  const types = [...Object.keys(typeLabels), 'unknown', ...new Set(learnset.moves.map(move => move.type).filter((type): type is string => !!type && !(type in typeLabels)))];
  const groups: LearnsetGroup[] = types.flatMap(type => {
    const moves = learnset.moves.filter(move => (move.type ?? 'unknown') === type);
    if (!moves.length) return [];
    const color = typeColors[type] ?? '#8492a3';
    const label = t(typeLabels[type] ?? (type === 'unknown' ? '타입 미확인' : type));
    return [{ type, label, color,
      badge: <span className="inline-flex items-center px-2 py-1 text-[14px] font-semibold leading-[1.3] rounded-[4px] whitespace-nowrap" style={{ backgroundColor: color, color: lightTextTypes.has(type) ? '#ffffff' : '#111923' }}>{label}</span>,
      moves: [...new Set(moves.map(move => move.name))].map(name => {
        const entries = moves.filter(move => move.name === name);
        const move = entries[0];
        return { name,
          methods: entries.map(entry => ({ method: entry.method, label: entry.method === 'level-up' ? t('레벨업 Lv.{level}', { level: entry.level ?? '—' }) : methodLabels[entry.method] ?? entry.method })),
          content: <>
            <div className="flex items-center justify-between gap-2"><strong className="text-[14px] font-medium text-ink">{referenceName(move, locale)}</strong><span className={`shrink-0 rounded px-1.5 py-0.5 text-[14px] font-medium ${{ physical: 'bg-orange-400/15 text-orange-700', special: 'bg-sky-400/15 text-sky-700', status: 'bg-violet-400/15 text-violet-700' }[move.category ?? ''] ?? 'text-slate-600'}`}>{{ physical: t('물리'), special: t('특수'), status: t('변화') }[move.category ?? ''] ?? t('분류 미확인')}</span></div>
            <div className="mt-2 flex items-center gap-2 whitespace-nowrap text-[14px]">
              <p className="inline-flex items-center gap-1 rounded px-2 py-1" style={{ backgroundColor: color, color: lightTextTypes.has(type) ? '#ffffff' : '#111923' }}><span>{t('위력')}</span> <strong className="font-semibold tabular-nums">{move.power ?? '—'}</strong></p>
              <p className="inline-flex items-center gap-1 rounded bg-line px-2 py-1 text-muted"><span>{t('명중')}</span> <strong className="font-semibold tabular-nums">{move.accuracy != null ? `${move.accuracy}%` : '—'}</strong></p>
            </div>
          </>,
        };
      }),
    }];
  });
  const methods = Object.entries(methodLabels).filter(([method]) => learnset.moves.some(move => move.method === method));
  return <LearnsetFilters groups={groups} methods={methods} />;
}
