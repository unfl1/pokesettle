"use client";

import Image from 'next/image';
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { PokemonSummary } from '../types';

const imageSizes = {
  small: 'w-8 h-8 max-phone:w-[23px] max-phone:h-[23px]',
  large: 'w-19.5 h-19.5 max-phone:w-16 max-phone:h-16',
};

function safeImage(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'raw.githubusercontent.com' &&
      parsed.pathname.startsWith('/PokeAPI/sprites/')
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export default function PokemonImage({
  pokemon,
  size,
}: {
  pokemon: Pick<PokemonSummary, 'nameKo' | 'nameEn' | 'images'>;
  size: 'small' | 'large';
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = [pokemon.images?.spriteUrl]
    .map(safeImage)
    .find((url) => url && !failed.includes(url));
  const name = pokemon.nameKo ?? pokemon.nameEn;
  return source ? (
    <Image
      className={`object-contain shrink-0 ${imageSizes[size]}`}
      src={source}
      width={size === 'large' ? 80 : 32}
      height={size === 'large' ? 80 : 32}
      sizes={size === 'large' ? '80px' : '32px'}
      alt={size === 'large' ? `${name} 이미지` : ''}
      loading={size === 'large' ? 'eager' : 'lazy'}
      fetchPriority={size === 'large' ? 'high' : 'auto'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed((old) => [...old, source])}
    />
  ) : (
    <span
      className={`inline-flex items-center justify-center text-muted shrink-0 ${imageSizes[size]}`}
      role={size === 'large' ? 'img' : undefined}
      aria-label={size === 'large' ? `${name} 이미지 없음` : undefined}
      aria-hidden={size === 'small' ? true : undefined}
    >
      <ImageOff size={size === 'large' ? 24 : 14} />
    </span>
  );
}
