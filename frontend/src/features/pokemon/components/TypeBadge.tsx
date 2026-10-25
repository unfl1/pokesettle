import { typeLabels } from '../typeLabels';

export const typeColors: Record<string, string> = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0',
  electric: 'var(--color-highlight)', grass: '#7AC74C', ice: '#96D9D6',
  fighting: '#C22E28', poison: '#A33EA1', ground: '#E2BF65',
  flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC',
  dark: '#705746', steel: '#B7B7CE', fairy: '#D685AD',
};
const lightTextTypes = new Set(['fighting', 'poison', 'ghost', 'dragon', 'dark']);

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-1 text-[10px] font-semibold leading-[1.3] rounded-[4px] whitespace-nowrap"
      style={{ backgroundColor: typeColors[type] ?? '#8492a3', color: lightTextTypes.has(type) ? '#ffffff' : '#111923' }}
    >
      {typeLabels[type] ?? type}
    </span>
  );
}
