import { ArrowUpRight } from 'lucide-react';
import type { Locale } from '../../../i18n/config';
import { createTranslator, type Dictionary } from '../../../i18n/translate';
import type { PokemonDetail } from '../types';

export default function PokemonDataNotes({ pokemon, locale, dictionary, descriptionVersion }: {
  pokemon: PokemonDetail; locale: Locale; dictionary: Dictionary; descriptionVersion?: string;
}) {
  const t = createTranslator(dictionary);
  return <aside className="page-data-notes mt-7 pt-4 border-t border-line text-muted text-[12px] leading-[1.8] min-w-0 [&_a]:text-muted [&_a]:underline [&_a]:underline-offset-[3px] [&_a_>_svg]:inline-block [&_a_>_svg]:align-middle pokedex-data-notes col-start-2 [align-self:end] max-tablet:col-start-1" aria-label={t('출처 및 이용 안내')}>
    <ul className="page-data-explanations grid gap-1.5 m-0 pl-4 list-disc [&_>_li]:min-w-0 [&_>_li]:wrap-anywhere [&_+_.page-data-row]:mt-3">
      <li>{t('Champions 적격성 미확인')}</li>
      <li>{t('포켓몬 내 최댓값 기준 · 실전 능력치와 다름')}</li>
      {pokemon.learnset && <li>{t('기준 버전:')} {pokemon.learnset.versionGroup} {t('· Champions 습득 여부 미확인')}</li>}
      {descriptionVersion && <li>{t('원본 게임:')} {descriptionVersion}</li>}
      {!pokemon.descriptions?.[locale] && locale !== 'ko' && (pokemon.description || pokemon.descriptions?.en) && <li>{t('선택한 언어의 설명이 없어 수집된 원문을 표시해요.')}</li>}
      {pokemon.formIdentifier && <li>{t('별도 폼:')} {pokemon.formIdentifier} {t('· 종 도감 번호 #')} {pokemon.speciesId}</li>}
    </ul>
    <div className="page-data-row flex flex-wrap [align-items:baseline] [gap:6px_22px] min-w-0 [&_+_.page-data-row]:mt-2.5 [&_>_*]:min-w-0 [&_>_*]:max-w-full [&_>_*]:m-0 [&_>_*]:wrap-anywhere screen-540:[gap:6px_14px]">
      <a href={pokemon.sourceUrl} target="_blank" rel="noreferrer">{t('PokéAPI 메타데이터 원문')} <ArrowUpRight size={12} aria-hidden="true" /></a>
      {pokemon.images && <p><a href={pokemon.images.sourceUrl} target="_blank" rel="noreferrer">{t('이미지 출처: PokéAPI sprites')}</a> · Pokémon © The Pokémon Company</p>}
    </div>
    <div className="page-data-row flex flex-wrap [align-items:baseline] [gap:6px_22px] min-w-0 [&_+_.page-data-row]:mt-2.5 [&_>_*]:min-w-0 [&_>_*]:max-w-full [&_>_*]:m-0 [&_>_*]:wrap-anywhere screen-540:[gap:6px_14px] page-data-details grid grid-cols-[minmax(0,_1fr)] gap-2.5 [&_summary]:cursor-pointer [&_details[open]_>_:not(summary)]:mt-1.5">
      {!!pokemon.nameSources?.length && <details>
        <summary>{t('이름 데이터 출처·수집일')}</summary>
        <p>{t('누락된 폼명은 원본 영어 이름으로 표시해요.')}</p>
        <div className="page-data-row flex flex-wrap [align-items:baseline] [gap:6px_22px] min-w-0 [&_+_.page-data-row]:mt-2.5 [&_>_*]:min-w-0 [&_>_*]:max-w-full [&_>_*]:m-0 [&_>_*]:wrap-anywhere screen-540:[gap:6px_14px]">{pokemon.nameSources.map(source => <a key={source.sourceUrl} href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceUrl.split('/').pop()} · {source.collectedAt.slice(0, 10)}</a>)}</div>
        {pokemon.nameLicenceUrl && <a href={pokemon.nameLicenceUrl} target="_blank" rel="noreferrer">{t('PokéAPI 이용 조건')}</a>}
      </details>}
      {!!pokemon.localizationSources?.length && <details>
        <summary>{t('번역 이름·설명 출처')}</summary>
        <div className="page-data-row flex flex-wrap [align-items:baseline] [gap:6px_22px] min-w-0 [&_+_.page-data-row]:mt-2.5 [&_>_*]:min-w-0 [&_>_*]:max-w-full [&_>_*]:m-0 [&_>_*]:wrap-anywhere screen-540:[gap:6px_14px]">{pokemon.localizationSources.map(source => <a key={`${source.url}-${source.contentHash}`} href={source.url} target="_blank" rel="noreferrer">{source.url.split('/').pop()} · {source.collectedAt.slice(0, 10)}</a>)}</div>
        {pokemon.localizationLicenceUrl && <a href={pokemon.localizationLicenceUrl} target="_blank" rel="noreferrer">{t('PokéAPI 이용 조건')}</a>}
      </details>}
      {!!pokemon.typeDefense?.sources.length && <details>
        <summary>{t('타입 상성 출처·수집일')}</summary>
        <div className="flex flex-wrap gap-x-5 gap-y-1">{pokemon.typeDefense.sources.map(source => <a key={source.sourceUrl} href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceUrl.split('/').pop()} · {source.collectedAt.slice(0, 10)}</a>)}</div>
        {pokemon.typeDefense.sources[0]?.licenceUrl && <a href={pokemon.typeDefense.sources[0].licenceUrl} target="_blank" rel="noreferrer">{t('PokéAPI 이용 조건')}</a>}
      </details>}
      {pokemon.learnset && <details>
        <summary>{t('기술 데이터 출처·수집일')}</summary>
        <p>{t('수집 자료 중 가장 최근 버전 그룹 기준 · 일반 도감 자료')}</p>
        <div className="page-data-row flex flex-wrap [align-items:baseline] [gap:6px_22px] min-w-0 [&_+_.page-data-row]:mt-2.5 [&_>_*]:min-w-0 [&_>_*]:max-w-full [&_>_*]:m-0 [&_>_*]:wrap-anywhere screen-540:[gap:6px_14px]">{pokemon.learnsetSources?.map(source => <a key={`${source.url}-${source.contentHash}`} href={source.url} target="_blank" rel="noreferrer">{source.url.split('/').pop()} · {source.collectedAt.slice(0, 10)}</a>)}</div>
        {pokemon.learnsetLicenceUrl && <a href={pokemon.learnsetLicenceUrl} target="_blank" rel="noreferrer">{t('PokéAPI 이용 조건')}</a>}
      </details>}
    </div>
  </aside>;
}
