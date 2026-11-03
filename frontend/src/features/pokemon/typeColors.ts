// Complete class names keep Tailwind source detection deterministic.
const typeBackgrounds: Record<string, string> = {
  normal: 'bg-[#A8A77A]',
  fire: 'bg-[#EE8130]',
  water: 'bg-[#6390F0]',
  electric: 'bg-highlight',
  grass: 'bg-[#7AC74C]',
  ice: 'bg-[#96D9D6]',
  fighting: 'bg-[#C22E28]',
  poison: 'bg-[#A33EA1]',
  ground: 'bg-[#E2BF65]',
  flying: 'bg-[#A98FF3]',
  psychic: 'bg-[#F95587]',
  bug: 'bg-[#A6B91A]',
  rock: 'bg-[#B6A136]',
  ghost: 'bg-[#735797]',
  dragon: 'bg-[#6F35FC]',
  dark: 'bg-[#705746]',
  steel: 'bg-[#B7B7CE]',
  fairy: 'bg-[#D685AD]',
};
const lightTextTypes = new Set(['fighting', 'poison', 'ghost', 'dragon', 'dark']);

export function typeColorClasses(type: string) {
  return `${typeBackgrounds[type] ?? 'bg-[#8492a3]'} ${lightTextTypes.has(type) ? 'text-white' : 'text-[#111923]'}`;
}

export const typeBorderClasses: Record<string, string> = {
  normal: 'border-l-[#A8A77A]',
  fire: 'border-l-[#EE8130]',
  water: 'border-l-[#6390F0]',
  electric: 'border-l-highlight',
  grass: 'border-l-[#7AC74C]',
  ice: 'border-l-[#96D9D6]',
  fighting: 'border-l-[#C22E28]',
  poison: 'border-l-[#A33EA1]',
  ground: 'border-l-[#E2BF65]',
  flying: 'border-l-[#A98FF3]',
  psychic: 'border-l-[#F95587]',
  bug: 'border-l-[#A6B91A]',
  rock: 'border-l-[#B6A136]',
  ghost: 'border-l-[#735797]',
  dragon: 'border-l-[#6F35FC]',
  dark: 'border-l-[#705746]',
  steel: 'border-l-[#B7B7CE]',
  fairy: 'border-l-[#D685AD]',
};
