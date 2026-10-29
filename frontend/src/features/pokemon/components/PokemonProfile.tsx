import type { Locale } from '../../../i18n/config';
import { createTranslator, type Dictionary } from '../../../i18n/translate';
import { pokemonName, referenceName } from '../routing';
import LearnsetFilters from './LearnsetFilters';
import { typeLabels } from '../typeNames';
import { typeColors, lightTextTypes } from '../typeColors';
import { ArrowUpRight, CircleHelp } from 'lucide-react';
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
export function PokemonProfile({ pokemon, locale, dictionary, headingLevel = 2 }: { pokemon: PokemonDetail; locale: Locale; dictionary: Dictionary; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const translate = createTranslator(dictionary);
  const description = pokemon.descriptions?.[locale] ?? (locale === 'ko' && pokemon.description ? { text: pokemon.description, version: pokemon.descriptionVersion } : pokemon.descriptions?.en);
  const descriptionLanguage = pokemon.descriptions?.[locale] || locale === 'ko' ? locale : 'en';
  const maximum = Math.max(...Object.values(pokemon.baseStats));
  return (
    <section
      className="border border-line rounded-[12px] bg-surface overflow-hidden"
      aria-label={translate("선택한 포켓몬 정보")}
    >
      <div className="px-5.5 py-[17px] gap-4.5 flex items-center max-desktop:px-[17px] max-desktop:gap-[13px] max-tablet:gap-3.5 max-phone:flex-wrap">
        <div className="border border-accent/17 w-20.5 h-20.5 rounded-[16px] bg-[radial-gradient(circle_at_40%_30%,_#fff0ee,_transparent_70%)] flex items-center justify-center text-accent relative shrink-0 overflow-hidden max-phone:w-16.5 max-phone:h-16.5 [&_svg]:mb-[7px]">
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
              <span key={t} className="inline-flex items-center px-2 py-1 text-[14px] font-semibold rounded-[4px]" style={{ backgroundColor: typeColors[t] ?? '#8492a3', color: lightTextTypes.has(t) ? '#fff' : '#111923' }}>{translate(typeLabels[t] ?? t)}</span>
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
          <span className="gap-[5px] flex items-center text-[14px] text-muted">
            <CircleHelp size={12} />
             {translate("Champions 적격성 미확인")} </span>
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
              {(!pokemon.descriptions?.[locale] && locale !== 'ko') && <p className="mt-1 text-[13px] text-muted">{translate("선택한 언어의 설명이 없어 수집된 원문을 표시해요.")}</p>}
              {(description?.version ?? pokemon.descriptionVersion) && <p className="text-[14px] text-muted mt-1">{translate("원본 게임:")} {description?.version ?? pokemon.descriptionVersion}</p>}
            </div>
          )}
          <div className="flex justify-between items-center mb-4 [&_h3]:text-[14px] [&_h3]:font-medium [&>span]:text-[14px] [&>span]:text-muted">
            <h3>{translate("종족값")}</h3>
          </div>
          <div className="grid grid-cols-[1fr_1fr] gap-y-2.5 gap-x-7.5 max-phone:grid-cols-[1fr]">
            {(Object.entries(pokemon.baseStats) as [StatName, number][]).map(
              ([key, value]) => (
                <div
                  className="gap-2.5 flex items-center text-[14px] [&>span]:w-[47px] [&>span]:text-muted [&_strong]:w-[25px] [&_strong]:text-right [&_strong]:text-[14px] [&_strong]:font-medium"
                  key={key}
                >
                  <span>{translate(statLabels[key])}</span>
                  <div className="h-1 bg-canvas rounded-[4px] flex-1 [&_i]:block [&_i]:bg-link/55 [&_i]:h-full [&_i]:rounded-[4px]">
                    <i style={{ width: `${(value / maximum) * 100}%` }} />
                  </div>
                  <strong>{value}</strong>
                </div>
              ),
            )}
          </div>
          <p className="text-[14px] text-muted mt-[15px]">
             {translate("포켓몬 내 최댓값 기준 · 실전 능력치와 다름")} </p>
          <LearnsetFilters pokemon={{ learnset: pokemon.learnset, learnsetSources: pokemon.learnsetSources, learnsetLicenceUrl: pokemon.learnsetLicenceUrl }} />
          <a
            className="gap-1 flex items-center text-link text-[14px] mt-[9px]"
            href={pokemon.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
             {translate("PokéAPI 메타데이터 원문")} <ArrowUpRight size={12} />
          </a>
          {pokemon.images && (
            <p className="text-[14px] leading-[1.8] text-muted mt-2 [&_a]:underline">
              <a
                className="text-link"
                href={pokemon.images.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                 {translate("이미지 출처: PokéAPI sprites")} </a>{' '}
              · Pokémon © The Pokémon Company
            </p>
          )}
          {!!pokemon.nameSources?.length && <details className="mt-3 text-[14px] text-muted">
            <summary className="cursor-pointer">{translate('이름 데이터 출처·수집일')}</summary>
            <p>{translate('누락된 폼명은 원본 영어 이름으로 표시해요.')}</p>
            {pokemon.nameSources.map(source => <p key={source.sourceUrl}><a className="text-link underline" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceUrl.split('/').pop()}</a> · {source.collectedAt.slice(0, 10)}</p>)}
            {pokemon.nameLicenceUrl && <a className="text-link underline" href={pokemon.nameLicenceUrl} target="_blank" rel="noreferrer">{translate('PokéAPI 이용 조건')}</a>}
          </details>}
          {!!pokemon.localizationSources?.length && <details className="mt-3 text-[14px] text-muted">
            <summary className="cursor-pointer">{translate("번역 이름·설명 출처")}</summary>
            {pokemon.localizationSources.map(source => <p key={source.url}><a className="text-link underline" href={source.url} target="_blank" rel="noreferrer">{source.url.split('/').pop()}</a> · {source.collectedAt.slice(0, 10)}</p>)}
            {pokemon.localizationLicenceUrl && <a className="text-link underline" href={pokemon.localizationLicenceUrl} target="_blank" rel="noreferrer">{translate("PokéAPI 이용 조건")}</a>}
          </details>}
          {pokemon.formIdentifier && (
            <p className="text-[14px] text-muted mt-[15px]">
               {translate("별도 폼:")} {pokemon.formIdentifier}  {translate("· 종 도감 번호 #")} {pokemon.speciesId}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
