import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Sparkles,
} from 'lucide-react';
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
export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`type-badge type-${type}`}>
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
    <section className="profile-card" aria-label="선택한 포켓몬 정보">
      <div className="profile-primary">
        <div
          className={`specimen specimen-${pokemon.types[0]}`}
          aria-hidden="true"
        >
          <span className="specimen-orbit" />
          <Sparkles size={29} strokeWidth={1.3} />
          <small>#{String(pokemon.speciesId).padStart(3, '0')}</small>
        </div>
        <div className="profile-name">
          <p className="eyebrow">현재 대화 주제</p>
          <div className="profile-name-line">
            <h2>{pokemon.nameKo ?? pokemon.nameEn}</h2>
            <span className="english-name">{pokemon.nameEn}</span>
          </div>
          <div className="types">
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
        <div className="profile-facts">
          <span className="small-label">특성 · 원문 이름</span>
          <p>{pokemon.abilities.join(' / ')}</p>
          <span className="eligibility">
            <CircleHelp size={12} />
            Champions 적격성 미확인
          </span>
        </div>
        <button className="guide-button" onClick={onGuide} disabled={disabled}>
          <BookOpen size={15} />
          근거 운용 가이드
          <ArrowUpRight size={15} />
        </button>
      </div>
      <details className="profile-details">
        <summary>
          종족값과 출처 확인
          <ChevronDown size={13} />
        </summary>
        <div className="stats-panel">
          <div className="stats-heading">
            <h3>기초 능력치</h3>
            <span>종족값 · 일반 도감 기준</span>
          </div>
          <div className="stats-grid">
            {(Object.entries(pokemon.baseStats) as [StatName, number][]).map(
              ([key, value]) => (
                <div className="stat-row" key={key}>
                  <span>{statLabels[key]}</span>
                  <div className="stat-track">
                    <i style={{ width: `${(value / maximum) * 100}%` }} />
                  </div>
                  <strong>{value}</strong>
                </div>
              ),
            )}
          </div>
          <p className="stats-footnote">
            그래프는 이 포켓몬의 최댓값 기준입니다. 실전 능력치와 다릅니다.
          </p>
          <a
            className="profile-source"
            href={pokemon.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            PokéAPI 메타데이터 원문
            <ArrowUpRight size={12} />
          </a>
        </div>
      </details>
    </section>
  );
}
