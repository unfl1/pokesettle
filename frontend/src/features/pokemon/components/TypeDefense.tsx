import type { Dictionary } from '../../../i18n/translate';
import { createTranslator } from '../../../i18n/translate';
import type { PokemonDetail } from '../types';
import { typeLabels } from '../typeNames';
import { typeColorClasses } from '../typeColors';

const groups = [
  { multiplier: 4, label: '×4', color: 'bg-rose-100 text-rose-800' },
  { multiplier: 2, label: '×2', color: 'bg-rose-50 text-rose-700' },
  { multiplier: 0.5, label: '½', color: 'bg-emerald-50 text-emerald-800' },
  { multiplier: 0.25, label: '¼', color: 'bg-emerald-100 text-emerald-800' },
  { multiplier: 0, label: '×0', color: 'bg-slate-100 text-slate-700' },
];

export default function TypeDefense({ defense, dictionary }: { defense: PokemonDetail['typeDefense']; dictionary: Dictionary }) {
  const t = createTranslator(dictionary);
  return <section aria-label={t('타입 상성')} className="min-w-0 border-t border-line pt-5 @min-[640px]:border-t-0 @min-[640px]:border-l @min-[640px]:pt-0 @min-[640px]:pl-6" data-testid="type-defense">
    <h3 className="text-[16px] font-bold text-ink">{t('타입 상성')}</h3>
    <p className="mt-2 text-[12px] leading-relaxed text-muted">{t('공격받을 때의 타입 배율')}</p>
    {defense ? <>
      <dl className="mt-4 space-y-3">
        {groups.map(group => {
          const types = Object.keys(typeLabels).filter(type => defense.multipliers.some(entry => entry.type === type && entry.multiplier === group.multiplier));
          if (!types.length) return null;
          return <div key={group.multiplier} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-3" data-multiplier={group.multiplier}>
            <dt className={`flex min-h-7 items-center justify-center rounded-md px-1 py-1 text-[14px] font-bold tabular-nums ${group.color}`}>
              <span aria-hidden="true">{group.label}</span><span className="sr-only">{group.multiplier === 0 ? t('무효') : t('{multiplier}배', { multiplier: group.multiplier })}</span>
            </dt>
            <dd className="m-0 flex min-w-0 flex-wrap gap-1.5">{types.map(type => <span key={type} className={`inline-flex min-h-7 items-center rounded-md px-2 py-1 text-[12px] font-semibold leading-5 whitespace-nowrap ${typeColorClasses(type)}`}>{t(typeLabels[type] ?? type)}</span>)}</dd>
          </div>;
        })}
      </dl>
      <p className="mt-4 text-[12px] leading-relaxed text-muted">{t('표시하지 않은 타입은 ×1입니다.')}</p>
    </> : <p className="mt-4 text-[14px] text-muted">{t('타입 상성 자료를 확인할 수 없어요.')}</p>}
    <p className="mt-2 text-[12px] leading-relaxed text-muted">{t('특성·도구·기술·필드 효과를 제외한 일반 타입 기준')}</p>
  </section>;
}
