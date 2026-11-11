import 'server-only';
import { metagameSelectionPath } from './routing';
import Link from 'next/link';
import { getI18n } from '../../i18n/server';
import { localeRegistry } from '../../i18n/config';
import { pokemonPath, pokemonName, referenceName } from '../pokemon/routing';
import PokemonImage from '../pokemon/components/PokemonImage';
import RefreshButton from '../../components/layout/RefreshButton';
import type { SinglesMeta } from './types';

const labels: Record<string, string> = {
  move: '기술', held_item: '도구', ability: '특성', stat_alignment: '성격',
};

export default async function MetagamePage({ data, selected }: { data: SinglesMeta | null; selected?: string }) {
  const { locale, t: translate } = await getI18n();
  const pokemon = data?.items.find(item => item.nameEn === selected) ?? data?.items[0];
  return (
    <section aria-label={translate("싱글 배틀 메타")} className="metagame-page flex flex-1 flex-col gap-5 [&_>_.page-data-notes]:mt-auto">
      <div className="rounded-xl border border-line bg-surface p-5 text-[14px] leading-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong>{translate("Champions 랭크 싱글 · 사용 순위 TOP 30")}</strong>
          <RefreshButton label={translate('다시 확인')} pendingLabel={translate('확인 중…')} />
        </div>

      </div>
      {data?.stale && <p className="notice flex items-center gap-3 py-3.75 px-4.5 mb-5 bg-warning-soft [border:1px_solid_var(--color-warning-line)] rounded-[10px] text-[14px] text-warning leading-[1.8] [&_button]:ml-auto [&_button]:whitespace-nowrap [&_button]:font-semibold screen-540:p-3 screen-540:text-[14px] screen-540:gap-[9px]" role="status">{translate("최신 자료에 연결하지 못해 임시 보관한 데이터를 표시하고 있어요. 기준일을 확인해 주세요.")}</p>}
      {!data && <div className="notice flex items-center gap-3 py-3.75 px-4.5 mb-5 bg-warning-soft [border:1px_solid_var(--color-warning-line)] rounded-[10px] text-[14px] text-warning leading-[1.8] [&_button]:ml-auto [&_button]:whitespace-nowrap [&_button]:font-semibold screen-540:p-3 screen-540:text-[14px] screen-540:gap-[9px]" role="alert"><p>{translate('싱글 메타를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')}</p><RefreshButton label={translate('다시 시도')} pendingLabel={translate('확인 중…')} /></div>}
      {data && !data.items.length && <p role="status">{translate("표시할 싱글 순위 데이터가 없어요.")}</p>}
      {pokemon && data && <div className="grid grid-cols-[minmax(220px,1fr)_minmax(0,2fr)] gap-5 max-tablet:grid-cols-1">
        <section className="rounded-xl border border-line bg-surface p-3" aria-label={translate("싱글 사용 순위")}>
          <ol className="max-h-[640px] overflow-auto">
            {data.items.map(item => <li key={item.nameEn}>
              <Link prefetch={false} scroll={false} href={metagameSelectionPath(item, locale)} aria-current={pokemon.nameEn === item.nameEn ? 'page' : undefined} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-canvas aria-[current=page]:bg-accent/8 aria-[current=page]:text-accent">
                <span className="w-8 shrink-0 text-[14px] tabular-nums">{translate('순위 {rank}', { rank: item.rank })}</span>
                <PokemonImage pokemon={item} size="small" />
                <span className="min-w-0 break-words text-[14px]">{pokemonName({ ...item, pokemonId: item.pokemonId ?? item.nameEn }, locale)}<small className="block text-[14px] text-muted">{item.nameEn}</small></span>
              </Link>
            </li>)}
          </ol>
        </section>
        <section className="min-w-0 rounded-xl border border-line bg-surface p-5" aria-label={translate("주요 세팅")}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <PokemonImage key={pokemon.nameEn} pokemon={pokemon} size="large" />
              <h2 className="min-w-0 break-words text-lg font-semibold">{pokemonName({ ...pokemon, pokemonId: pokemon.pokemonId ?? pokemon.nameEn }, locale)} <span className="text-[14px] text-muted">{translate('순위 {rank}', { rank: pokemon.rank })}</span></h2>
            </div>
            {pokemon.pokemonId && <Link prefetch={false} className="text-[14px] text-accent" href={pokemonPath({ pokemonId: pokemon.pokemonId, nameKo: pokemon.nameKo, nameEn: pokemon.nameEn, names: pokemon.names, slugs: pokemon.slugs }, locale)}>{translate("도감 보기 →")}</Link>}
          </div>
          <div className="grid grid-cols-2 gap-5 max-phone:grid-cols-1">
            {pokemon.groups.map(group => <section key={group.category} className="min-w-0">
              <h3 className="mb-2 font-semibold text-[14px]">{translate(labels[group.category] ?? group.category)} <span className="font-normal text-[14px] text-muted">{translate("채용률")}</span></h3>
              {!group.items.length ? <p className="text-[14px] text-muted">{translate("제공된 정보 없음")}</p> : <ul className="space-y-2">
                {group.items.map(entry => <li key={`${entry.rank}-${entry.name}`} className="flex items-center justify-between gap-3 rounded-md bg-canvas p-2 text-[14px]">
                  <span className="min-w-0 break-words">{referenceName(entry, locale)}</span>
                  <span className="shrink-0 tabular-nums text-muted">{entry.percentage === null ? translate("미제공") : `${entry.percentage}%`}</span>
                </li>)}
              </ul>}
            </section>)}
          </div>

        </section>
      </div>}
      <aside className="page-data-notes mt-7 pt-4 border-t border-line text-muted text-[12px] leading-[1.8] min-w-0 [&_a]:text-muted [&_a]:underline [&_a]:underline-offset-[3px] [&_a_>_svg]:inline-block [&_a_>_svg]:align-middle" aria-label={translate('출처 및 이용 안내')}>
        <ul className="page-data-explanations grid gap-1.5 m-0 pl-4 list-disc [&_>_li]:min-w-0 [&_>_li]:wrap-anywhere [&_+_.page-data-row]:mt-3">
          <li>{translate("사용 순위는 승률을 뜻하지 않아요.")}</li>
          <li>{translate("채용률은 기술·도구·특성·성격별 통계이며, 하나의 완성된 세트가 아니에요.")}</li>
          <li>{translate("수집된 한국어 이름이 없는 항목은 원문으로 표시해요.")}</li>
          <li>{translate("현재 출전 가능 여부와 세팅의 실전 성능은 별도 확인이 필요해요.")}</li>
        </ul>
        {data && <>
          <div className="page-data-row flex flex-wrap [align-items:baseline] [gap:6px_22px] min-w-0 [&_+_.page-data-row]:mt-2.5 [&_>_*]:min-w-0 [&_>_*]:max-w-full [&_>_*]:m-0 [&_>_*]:wrap-anywhere screen-540:[gap:6px_14px]">
            <p>{translate("시즌")} {data.season} {translate("· 데이터 기준일")} {data.dataDate} {translate("· 레귤레이션 미확인")}</p>
            <p>{translate("서버 조회:")} {new Date(data.collectedAt).toLocaleString(localeRegistry[locale].htmlLang, { timeZone: 'Asia/Seoul' })} {translate("· 비공식 제공 자료")}</p>
          </div>
          <div className="page-data-row flex flex-wrap [align-items:baseline] [gap:6px_22px] min-w-0 [&_+_.page-data-row]:mt-2.5 [&_>_*]:min-w-0 [&_>_*]:max-w-full [&_>_*]:m-0 [&_>_*]:wrap-anywhere screen-540:[gap:6px_14px]">
            <a href={data.sourceUrl} target="_blank" rel="noreferrer">{data.attribution}</a>
            <a href={data.termsUrl} target="_blank" rel="noreferrer">{translate("이용 조건")}</a>
            {data.nameSources?.length > 0 && <p>{translate("도구·성격 한국어 이름: PokéAPI · 수집일")} {data.nameSources[0].collectedAt.slice(0, 10)} · <a href={data.nameLicenceUrl ?? undefined} target="_blank" rel="noreferrer">{translate("이용 조건")}</a></p>}
            {pokemon?.images && <p>{translate("이미지:")} <a href={pokemon.images.sourceUrl} target="_blank" rel="noreferrer">PokéAPI sprites</a> · {pokemon.images.rightsNotice}</p>}
          </div>
        </>}
      </aside>
    </section>
  );
}
