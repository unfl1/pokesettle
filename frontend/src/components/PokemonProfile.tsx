import { ArrowUpRight, BookOpen, ChevronDown, CircleHelp } from 'lucide-react';
import PokemonImage from './PokemonImage';
import type { PokemonDetail, StatName } from '../types';

export const typeLabels: Record<string, string> = {
  normal: '노말',
  fire: '불꽃',
  water: '물',
  electric: '전기',
  grass: '풀',
  ice: '얼음',
  fighting: '격투',
  poison: '독',
  ground: '땅',
  flying: '비행',
  psychic: '에스퍼',
  bug: '벌레',
  rock: '바위',
  ghost: '고스트',
  dragon: '드래곤',
  dark: '악',
  steel: '강철',
  fairy: '페어리',
};
const typeColors: Record<string, string> = {
  normal: 'text-[#a6b5c7] bg-[#a6b5c714]',
  fire: 'text-[#e6a080] bg-[#e6a08016]',
  water: 'text-[#8bb5d9] bg-[#8bb5d916]',
  electric: 'text-[#e5c96e] bg-[#e5c96e16]',
  grass: 'text-[#a1c982] bg-[#a1c98216]',
  ice: 'text-[#8bb5d9] bg-[#8bb5d916]',
  fighting: 'text-[#a6b5c7] bg-[#a6b5c714]',
  poison: 'text-[#b6a0d1] bg-[#b6a0d116]',
  ground: 'text-[#c6b48e] bg-[#c6b48e16]',
  flying: 'text-[#a6b5c7] bg-[#a6b5c714]',
  psychic: 'text-[#b6a0d1] bg-[#b6a0d116]',
  bug: 'text-[#a1c982] bg-[#a1c98216]',
  rock: 'text-[#c6b48e] bg-[#c6b48e16]',
  ghost: 'text-[#b6a0d1] bg-[#b6a0d116]',
  dragon: 'text-[#a6b5c7] bg-[#a6b5c714]',
  dark: 'text-[#a6b5c7] bg-[#a6b5c714]',
  steel: 'text-[#a6b5c7] bg-[#a6b5c714]',
  fairy: 'text-[#d5a5bf] bg-[#d5a5bf16]',
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`px-[7px] py-[3px] text-[9px] leading-[1.3] rounded-[4px] whitespace-nowrap ${typeColors[type] ?? typeColors.normal}`}
    >
      {typeLabels[type] ?? type}
    </span>
  );
}

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
            현재 대화 주제
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
        <div className="ml-auto border-l border-l-[#2b3644] pl-5.5 text-[10px] max-desktop:hidden [&_p]:mx-0 [&_p]:mt-1.5 [&_p]:mb-2.5 [&_p]:text-[11px] [&_p]:text-[#c0cedd]">
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
      <details
        className="border-t border-t-[#283341] [&>summary]:px-5.5 [&>summary]:py-[9px] [&>summary]:flex [&>summary]:items-center [&>summary]:justify-between [&>summary]:text-[#8295a8] [&>summary]:text-[9px] [&>summary]:cursor-pointer [&>summary]:list-none [&[open]>summary_svg]:transform-[rotate(180deg)]"
        data-testid="profile-details"
      >
        <summary>
          종족값과 출처 확인
          <ChevronDown size={13} />
        </summary>
        <div className="px-5.5 pt-2.5 pb-4.5">
          <div className="flex justify-between items-center mb-4 [&_h3]:text-[11px] [&_h3]:font-medium [&>span]:text-[9px] [&>span]:text-[#7d91a7]">
            <h3>기초 능력치</h3>
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
      </details>
    </section>
  );
}
