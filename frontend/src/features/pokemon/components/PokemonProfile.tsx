import { ArrowUpRight, BookOpen, CircleHelp } from 'lucide-react';
import { useState } from 'react';
import { typeLabels } from '../typeLabels';
import PokemonImage from './PokemonImage';
import { TypeBadge, typeColors } from './TypeBadge';
import type { PokemonDetail, StatName } from '../types';

const statLabels: Record<StatName, string> = {
  hp: 'HP',
  attack: '공격',
  defense: '방어',
  spAttack: '특수공격',
  spDefense: '특수방어',
  speed: '스피드',
};
export function PokemonProfile({
  pokemon,
  onGuide,
  disabled,
}: {
  pokemon: PokemonDetail;
  onGuide: () => void;
  disabled: boolean;
}) {
  const [learnMethod, setLearnMethod] = useState('all');
  const [learnType, setLearnType] = useState('all');
  const maximum = Math.max(...Object.values(pokemon.baseStats));
  return (
    <section
      className="border border-[#2b3441] rounded-[12px] bg-[#151c26] overflow-hidden"
      aria-label="선택한 포켓몬 정보"
    >
      <div className="px-5.5 py-[17px] gap-4.5 flex items-center max-desktop:px-[17px] max-desktop:gap-[13px] max-tablet:gap-3.5 max-phone:flex-wrap">
        <div className="border border-[#a7efc52b] w-20.5 h-20.5 rounded-[16px] bg-[radial-gradient(circle_at_40%_30%,_#a7efc519,_transparent_70%)] flex items-center justify-center text-accent relative shrink-0 overflow-hidden max-phone:w-16.5 max-phone:h-16.5 [&_svg]:mb-[7px]">
          <PokemonImage
            key={pokemon.pokemonId}
            pokemon={pokemon}
            size="large"
          />
        </div>
        <div className="min-w-0 [&_h2]:text-[21px] [&_h2]:font-semibold [&_h2]:tracking-[-0.5px] [&_h2]:leading-[1.2]">
          <p className="gap-1.5 text-[9px] tracking-[0.7px] text-[#8295a8] flex items-center">
            살펴보는 포켓몬
          </p>
          <div className="mx-0 gap-2.5 flex items-baseline mt-[5px] mb-2 flex-wrap max-phone:gap-1.5">
            <h2>{pokemon.nameKo ?? pokemon.nameEn}</h2>
            <span className="text-[10px] text-[#758aa0]">{pokemon.nameEn}</span>
          </div>
          <div className="gap-[5px] flex">
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
        <div className="ml-auto border-l border-l-[#2b3644] pl-5.5 text-[10px] max-phone:w-full [&_p]:mx-0 [&_p]:mt-1.5 [&_p]:mb-2.5 [&_p]:text-[11px] [&_p]:text-[#c0cedd]">
          <span className="text-[9px] text-[#7d91a7]">특성 · 원문 이름</span>
          <p>{pokemon.abilities.join(' / ')}</p>
          <span className="gap-[5px] flex items-center text-[9px] text-[#8295a8]">
            <CircleHelp size={12} />
            Champions 적격성 미확인
          </span>
        </div>
        <button
          className="px-3 py-2.5 border border-[#a7efc540] gap-2 ml-auto flex items-center rounded-[6px] text-[10px] text-[#b8ddc8] whitespace-nowrap max-tablet:p-[9px] max-tablet:text-[9px] max-phone:w-full max-phone:justify-center"
          onClick={onGuide}
          disabled={disabled}
        >
          <BookOpen size={15} />
          근거 운용 가이드
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div
        className="border-t border-t-[#283341] [&>summary]:px-5.5 [&>summary]:py-[9px] [&>summary]:flex [&>summary]:items-center [&>summary]:justify-between [&>summary]:text-[#8295a8] [&>summary]:text-[9px] [&>summary]:cursor-pointer [&>summary]:list-none [&[open]>summary_svg]:transform-[rotate(180deg)]"
        data-testid="profile-details"
      >
        <div className="px-5.5 pt-2.5 pb-4.5">
          {pokemon.description && (
            <div className="mb-4 text-[12px] leading-relaxed text-[#c0cedd]">
              <h3 className="font-medium mb-1">도감 설명</h3>
              <p>{pokemon.description}</p>
              {pokemon.descriptionVersion && <p className="text-[10px] text-[#8295a8] mt-1">원본 게임: {pokemon.descriptionVersion}</p>}
            </div>
          )}
          <div className="flex justify-between items-center mb-4 [&_h3]:text-[11px] [&_h3]:font-medium [&>span]:text-[9px] [&>span]:text-[#7d91a7]">
            <h3>종족값</h3>
            <span>종족값 · 일반 도감 기준</span>
          </div>
          <div className="grid grid-cols-[1fr_1fr] gap-y-2.5 gap-x-7.5 max-phone:grid-cols-[1fr]">
            {(Object.entries(pokemon.baseStats) as [StatName, number][]).map(
              ([key, value]) => (
                <div
                  className="gap-2.5 flex items-center text-[10px] [&>span]:w-[47px] [&>span]:text-[#9eafc1] [&_strong]:w-[25px] [&_strong]:text-right [&_strong]:text-[10px] [&_strong]:font-medium"
                  key={key}
                >
                  <span>{statLabels[key]}</span>
                  <div className="h-1 bg-[#27313e] rounded-[4px] flex-1 [&_i]:block [&_i]:bg-[#8fbfa8] [&_i]:h-full [&_i]:rounded-[4px]">
                    <i style={{ width: `${(value / maximum) * 100}%` }} />
                  </div>
                  <strong>{value}</strong>
                </div>
              ),
            )}
          </div>
          <p className="text-[9px] text-[#7d91a7] mt-[15px]">
            그래프는 이 포켓몬의 최댓값 기준입니다. 실전 능력치와 다릅니다.
          </p>
          <div className="mt-4 mb-4 text-[11px]" data-testid="pokemon-learnset">
            <h3 className="font-medium mb-2">배울 수 있는 기술</h3>
            {pokemon.learnset ? <>
              <p className="text-[10px] text-[#8295a8] mb-3">
                원본 게임: {pokemon.learnset.versionGroup} · 수집 자료 중 가장 최근 버전 그룹 기준 · Champions 습득 가능 여부 미확인
              </p>
              <label className="flex items-center gap-2 mb-3 text-[11px] text-[#9eafc1]">타입별 보기
                <select aria-label="기술 타입 필터" value={learnType} onChange={e => setLearnType(e.target.value)} className="rounded-md border border-[#344253] bg-[#111923] px-3 py-2 text-[#c0cedd]">
                  <option value="all">전체 타입</option>
                  {[...new Set(pokemon.learnset.moves.map(m => m.type ?? 'unknown'))].map(type => <option key={type} value={type}>{typeLabels[type] ?? (type === 'unknown' ? '타입 미확인' : type)}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-2 mb-3" aria-label="기술 습득 방법 필터">
                {Object.entries({ all: '전체', 'level-up': '레벨업', machine: '기술머신·비전머신', egg: '알 기술', tutor: '기술 가르침', train: '트레이닝' }).filter(([method]) => method === 'all' || pokemon.learnset!.moves.some(m => m.method === method)).map(([method, label]) => <button key={method} type="button" aria-pressed={learnMethod === method} onClick={() => setLearnMethod(method)} className={`rounded-md border px-3 py-2 text-[11px] ${learnMethod === method ? 'border-[#8fbfa8] bg-[#8fbfa81a] text-[#b8ddc8]' : 'border-[#344253] text-[#9eafc1]'}`}>{label}</button>)}
              </div>
              <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                {[...Object.keys(typeLabels), 'unknown', ...new Set(pokemon.learnset.moves.map(m => m.type).filter((t): t is string => !!t && !(t in typeLabels)))].map(type => {
                  const moves = pokemon.learnset!.moves.filter(m => (m.type ?? 'unknown') === type && (learnMethod === 'all' || m.method === learnMethod));
                  if (!moves.length || (learnType !== 'all' && learnType !== type)) return null;
                  const unique = [...new Set(moves.map(m => m.name))];
                  return <section key={type} aria-label={`${typeLabels[type] ?? (type === 'unknown' ? '타입 미확인' : type)} 타입 기술`}>
                    <div className="flex items-center gap-2 mb-2"><TypeBadge type={type === 'unknown' ? '타입 미확인' : type} /><span className="text-[10px] text-[#8295a8]">{unique.length}개</span></div>
                    <div className="grid grid-cols-4 gap-2 max-tablet:grid-cols-2 max-phone:grid-cols-1">
                      {unique.map(name => {
                        const entries = moves.filter(m => m.name === name);
                        const move = entries[0];
                        return <div key={name} className="rounded-lg border border-[#2b3644] border-l-[3px] bg-[#111923] px-3 py-2.5" style={{ borderLeftColor: typeColors[type] ?? '#8492a3' }}>
                          <div className="flex items-center justify-between gap-2"><strong className="text-[12px] font-medium text-[#d2dce6]">{name}</strong><span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${{ physical: 'bg-orange-400/15 text-orange-200', special: 'bg-sky-400/15 text-sky-200', status: 'bg-violet-400/15 text-violet-200' }[move.category ?? ''] ?? 'text-slate-300'}`}>{{ physical: '물리', special: '특수', status: '변화' }[move.category ?? ''] ?? '분류 미확인'}</span></div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                            <p className="rounded bg-amber-400/10 px-2 py-1"><span className="text-amber-200/80">위력 </span><strong className="font-semibold text-amber-100 tabular-nums">{move.power ?? '—'}</strong></p>
                            <p className="rounded bg-cyan-400/10 px-2 py-1"><span className="text-cyan-200/80">명중 </span><strong className="font-semibold text-cyan-100 tabular-nums">{move.accuracy != null ? `${move.accuracy}%` : '—'}</strong></p>
                          </div>
                          <p className="text-[10px] text-[#9eafc1] mt-1">{entries.map(m => m.method === 'level-up' ? `레벨업 Lv.${m.level}` : ({ machine: '기술머신·비전머신', egg: '알 기술', tutor: '기술 가르침', train: '트레이닝' }[m.method] ?? m.method)).join(' · ')}</p>
                        </div>;
                      })}
                    </div>
                  </section>;
                })}
              </div>
              <details className="mt-2 text-[10px] text-[#8295a8]">
                <summary className="cursor-pointer">기술 데이터 출처·수집일</summary>
                {pokemon.learnsetSources?.map(source => <p key={source.url}><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.url.split('/').pop()}</a> · {source.collectedAt.slice(0, 10)}</p>)}
                {pokemon.learnsetLicenceUrl && <a className="underline" href={pokemon.learnsetLicenceUrl} target="_blank" rel="noreferrer">PokéAPI 이용 조건</a>}
              </details>
            </> : <p className="text-[#8295a8]">이 포켓몬의 버전별 기술 습득 자료가 아직 등록되지 않았습니다.</p>}
          </div>
          <a
            className="gap-1 flex items-center text-[#99b9ac] text-[9px] mt-[9px]"
            href={pokemon.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            PokéAPI 메타데이터 원문
            <ArrowUpRight size={12} />
          </a>
          {pokemon.images && (
            <p className="text-[9px] leading-[1.8] text-[#8499ad] mt-2 [&_a]:underline">
              <a
                href={pokemon.images.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                이미지 출처: PokéAPI sprites
              </a>{' '}
              · Pokémon © The Pokémon Company
            </p>
          )}
          {pokemon.formIdentifier && (
            <p className="text-[9px] text-[#7d91a7] mt-[15px]">
              별도 폼: {pokemon.formIdentifier} · 종 도감 번호 #
              {pokemon.speciesId}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
