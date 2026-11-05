import type { Locale } from '../../../i18n/config';
import { createTranslator, type Dictionary } from '../../../i18n/translate';
import { pokemonName, referenceName } from '../routing';
import Learnset from './Learnset';
import TypeDefense from './TypeDefense';
import { typeLabels } from '../typeNames';
import { typeColorClasses } from '../typeColors';
import PokemonDataNotes from './PokemonDataNotes';
import PokemonImage from './PokemonImage';
import type { PokemonDetail, StatName } from '../types';

const statLabels: Record<StatName, string> = {
  hp: 'HP',
  attack: '공격',
  defense: '방어',
  spAttack: '특수공격',
  spDefense: '특수방어',
  speed: '스피드',
};
const statColors: Record<StatName, string> = {
  hp: 'fill-rose-500', attack: 'fill-orange-500', defense: 'fill-amber-500',
  spAttack: 'fill-blue-500', spDefense: 'fill-emerald-500', speed: 'fill-pink-500',
};
export function PokemonProfile({ pokemon, locale, dictionary, headingLevel = 2 }: { pokemon: PokemonDetail; locale: Locale; dictionary: Dictionary; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const translate = createTranslator(dictionary);
  const description = pokemon.descriptions?.[locale] ?? (locale === 'ko' && pokemon.description ? { text: pokemon.description, version: pokemon.descriptionVersion } : pokemon.descriptions?.en);
  const descriptionLanguage = pokemon.descriptions?.[locale] || locale === 'ko' ? locale : 'en';
  const maximum = Math.max(...Object.values(pokemon.baseStats));
  return (<>
    <section
      className="border border-line rounded-[12px] bg-surface overflow-hidden"
      aria-label={translate("선택한 포켓몬 정보")}
    >
      <div className="px-5.5 py-[17px] gap-4.5 flex items-center max-desktop:px-[17px] max-desktop:gap-[13px] max-tablet:gap-3.5 max-phone:flex-wrap">
        <div className="border border-line w-20.5 h-20.5 rounded-[16px] bg-surface flex items-center justify-center text-muted relative shrink-0 overflow-hidden max-phone:w-16.5 max-phone:h-16.5 [&_svg]:mb-[7px]">
          <PokemonImage
            key={pokemon.pokemonId}
            pokemon={pokemon}
            size="large"
          />
        </div>
        <div className="min-w-0 [&_h2]:text-[21px] [&_h2]:font-semibold [&_h2]:tracking-[-0.5px] [&_h2]:leading-[1.2]">
          <div className="mx-0 gap-2.5 flex items-baseline mt-[5px] mb-2 flex-wrap max-phone:gap-1.5">
            <Heading className="text-[21px] font-semibold leading-[1.2]" lang={pokemon.names?.[locale] ? undefined : pokemon.names?.en ? 'en' : locale === 'ko' && pokemon.nameKo ? 'ko' : 'en'}>{pokemonName(pokemon, locale)}</Heading>
            <span className="text-[14px] text-muted">{pokemon.nameEn}</span>
          </div>
          <div className="gap-[5px] flex">
            {pokemon.types.map((t) => (
              <span key={t} className={`inline-flex items-center px-2 py-1 text-[14px] font-semibold rounded-[4px] ${typeColorClasses(t)}`} >{translate(typeLabels[t] ?? t)}</span>
            ))}
          </div>
        </div>
        <div className="ml-auto border-l border-l-line pl-5.5 text-[14px] max-phone:w-full [&_p]:mx-0 [&_p]:mt-1.5 [&_p]:mb-2.5 [&_p]:text-[14px] [&_p]:text-ink">
          <span className="text-[14px] text-muted">{translate("특성")}</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2 mb-3">
            {(pokemon.abilityDetails ?? pokemon.abilities.map(name => ({name, nameKo: null}))).map(ability => <div key={ability.name}>
              <strong className="block text-[14px] font-semibold text-ink">{referenceName(ability, locale)}</strong>
              <span className="block mt-1 text-[14px] text-muted">{ability.name}</span>
            </div>)}
          </div>
        </div>
      </div>
      <div
        className="border-t border-t-line [&>summary]:px-5.5 [&>summary]:py-[9px] [&>summary]:flex [&>summary]:items-center [&>summary]:justify-between [&>summary]:text-muted [&>summary]:text-[14px] [&>summary]:cursor-pointer [&>summary]:list-none [&[open]>summary_svg]:transform-[rotate(180deg)]"
        data-testid="profile-details"
      >
        <div className="px-5.5 pt-2.5 pb-4.5">
          {(description || pokemon.description) && (
            <div className="mb-4 text-[14px] leading-relaxed text-ink">
              <h3 className="font-medium mb-1">{translate("도감 설명")}</h3>
              <p lang={description ? descriptionLanguage : 'ko'}>{description?.text ?? pokemon.description}</p>
            </div>
          )}
          <div className="@container mt-5 mb-6 border-t border-line pt-5">
            <div className="grid grid-cols-1 gap-6 @min-[640px]:grid-cols-2">
              <section aria-label={translate('종족값')} className="min-w-0" data-testid="base-stats">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[16px] font-bold text-ink">{translate('종족값')}</h3>
                  <p className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted">{translate('합계')}<strong className="text-[18px] font-bold tabular-nums text-ink">{Object.values(pokemon.baseStats).reduce((sum, value) => sum + value, 0)}</strong></p>
                </div>
                <p className="mb-4 text-[12px] leading-relaxed text-muted">{translate('실전 능력치가 아닌 종족값입니다.')}</p>
                <dl className="space-y-3">
                  {(Object.entries(statLabels) as [StatName, string][]).map(([key, label]) => {
                    const value = pokemon.baseStats[key];
                    return <div key={key} className="grid grid-cols-[64px_32px_minmax(0,1fr)] items-center gap-2.5 text-[14px]">
                      <dt className="text-muted">{translate(label)}</dt>
                      <dd className="m-0 text-right font-semibold tabular-nums text-ink">{value}</dd>
                      <dd className="m-0 h-2 overflow-hidden rounded-full bg-canvas" aria-hidden="true"><svg className={`block h-full w-full ${statColors[key]}`} viewBox={`0 0 ${maximum || 1} 1`} preserveAspectRatio="none"><rect width={value} height="1" rx="0.5" /></svg></dd>
                    </div>;
                  })}
                </dl>
              </section>
              <TypeDefense defense={pokemon.typeDefense} dictionary={dictionary} />
            </div>
          </div>
          <Learnset pokemon={{ learnset: pokemon.learnset }} locale={locale} dictionary={dictionary} />
        </div>
      </div>
    </section>
    <PokemonDataNotes pokemon={pokemon} locale={locale} dictionary={dictionary} descriptionVersion={description?.version ?? pokemon.descriptionVersion} />
  </>);
}
