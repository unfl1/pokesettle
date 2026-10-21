import { typeLabels } from '../typeLabels';

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
