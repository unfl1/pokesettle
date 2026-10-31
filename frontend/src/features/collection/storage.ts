export const collectionKey = 'pokesettle:kanto-collection:v1';
export const cooldownKey = 'pokesettle:kanto-next-catch-at:v1';
export const catchCooldownMs = 10 * 60 * 1000;
export const kantoCount = 151;

export function parseNextCatchAt(raw: string | null): number {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export function parseCollection(raw: string | null): number[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Invalid collection');
  return [...new Set(value.filter((id): id is number =>
    typeof id === 'number' && Number.isInteger(id) && id >= 1 && id <= kantoCount,
  ))].sort((a, b) => a - b);
}

export function pickUncaught(caught: number[]): number | null {
  const available = Array.from({ length: kantoCount }, (_, index) => index + 1)
    .filter(id => !caught.includes(id));
  return available.length ? available[Math.floor(Math.random() * available.length)] : null;
}
