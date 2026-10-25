import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request } from '../../lib/apiClient';

type Entry = { name: string; nameKo: string | null; rank: number; percentage: number | null };
type MetaPokemon = {
  nameEn: string; nameKo: string | null; pokemonId: string | null; rank: number;
  groups: { category: string; items: Entry[] }[];
};
type SinglesMeta = {
  items: MetaPokemon[]; season: string; dataDate: string;
  collectedAt: string; providerGeneratedAt: string | null; stale: boolean;
  sourceUrl: string; termsUrl: string; attribution: string;
};
const labels: Record<string, string> = {
  move: '기술', held_item: '도구', ability: '특성', stat_alignment: '성격',
};

export default function MetagamePage({ active }: { active: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['meta', 'singles'],
    queryFn: () => request<SinglesMeta>('/meta/singles'),
    enabled: active,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const data = query.data;
  const pokemon = data?.items.find(item => item.nameEn === selected) ?? data?.items[0];
  return (
    <section aria-label="싱글 배틀 메타" className="space-y-5">
      <div className="rounded-xl border border-line bg-surface p-5 text-sm leading-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong>Champions 랭크 싱글 · 사용 순위 TOP 30</strong>
          <button className="text-accent" disabled={query.isFetching} onClick={() => void query.refetch()}>
            {query.isFetching ? '확인 중…' : '다시 확인'}
          </button>
        </div>
        <p className="text-muted">사용 순위는 승률을 뜻하지 않아요. 아래 채용률은 해당 포켓몬의 기술·도구·특성·성격별 통계이며, 하나의 완성된 세트가 아니에요.</p>
        {data && <div className="mt-2 text-xs text-muted">
          <p>시즌 {data.season} · 데이터 기준일 {data.dataDate} · 레귤레이션 미확인</p>
          <p>서버 조회: {new Date(data.collectedAt).toLocaleString('ko-KR')} · 비공식 제공 자료</p>
          <a className="text-accent underline" href={data.sourceUrl} target="_blank" rel="noreferrer">{data.attribution}</a>
          {' · '}<a className="underline" href={data.termsUrl} target="_blank" rel="noreferrer">이용 조건</a>
        </div>}
      </div>
      {data?.stale && <p className="notice" role="status">최신 자료에 연결하지 못해 임시 보관한 데이터를 표시하고 있어요. 기준일을 확인해 주세요.</p>}
      {query.isPending && <p role="status" className="p-6 text-muted">싱글 메타를 불러오고 있어요.</p>}
      {query.error && <div className="notice" role="alert"><p>{query.error.message}</p><button onClick={() => void query.refetch()}>다시 시도</button></div>}
      {data && !data.items.length && <p role="status">표시할 싱글 순위 데이터가 없어요.</p>}
      {pokemon && data && <div className="grid grid-cols-[minmax(220px,1fr)_minmax(0,2fr)] gap-5 max-tablet:grid-cols-1">
        <section className="rounded-xl border border-line bg-surface p-3" aria-label="싱글 사용 순위">
          <ol className="max-h-[640px] overflow-auto">
            {data.items.map(item => <li key={item.nameEn}>
              <button aria-pressed={pokemon.nameEn === item.nameEn} onClick={() => setSelected(item.nameEn)} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-canvas aria-pressed:bg-accent/8 aria-pressed:text-accent">
                <span className="w-8 shrink-0 text-sm tabular-nums">{item.rank}위</span>
                <span className="min-w-0 break-words text-sm">{item.nameKo ?? item.nameEn}<small className="block text-xs text-muted">{item.nameEn}</small></span>
              </button>
            </li>)}
          </ol>
        </section>
        <section className="min-w-0 rounded-xl border border-line bg-surface p-5" aria-label="주요 세팅">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{pokemon.nameKo ?? pokemon.nameEn} <span className="text-sm text-muted">{pokemon.rank}위</span></h2>
            {pokemon.pokemonId && <Link className="text-sm text-accent" to={`/pokedex?pokemon=${encodeURIComponent(pokemon.pokemonId)}`}>도감 보기 →</Link>}
          </div>
          <p className="mb-5 text-xs leading-6 text-muted">수집된 한국어 이름이 없는 항목은 원문으로 표시해요. 현재 출전 가능 여부와 세팅의 실전 성능은 별도 확인이 필요해요.</p>
          <div className="grid grid-cols-2 gap-5 max-phone:grid-cols-1">
            {pokemon.groups.map(group => <section key={group.category} className="min-w-0">
              <h3 className="mb-2 font-semibold text-sm">{labels[group.category] ?? group.category} <span className="font-normal text-xs text-muted">채용률</span></h3>
              {!group.items.length ? <p className="text-sm text-muted">제공된 정보 없음</p> : <ul className="space-y-2">
                {group.items.map(entry => <li key={`${entry.rank}-${entry.name}`} className="flex items-center justify-between gap-3 rounded-md bg-canvas p-2 text-sm">
                  <span className="min-w-0 break-words">{entry.nameKo ?? entry.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">{entry.percentage === null ? '미제공' : `${entry.percentage}%`}</span>
                </li>)}
              </ul>}
            </section>)}
          </div>
        </section>
      </div>}
    </section>
  );
}
