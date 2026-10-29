"use client";

import { useI18n } from '../../../i18n/I18nProvider';

import Image from 'next/image';
import { pokemonName } from '../routing';
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { PokemonImages, PokemonSummary } from '../types';

const imageSizes = {
  small: 'w-8 h-8 max-phone:w-[23px] max-phone:h-[23px]',
  large: 'w-19.5 h-19.5 max-phone:w-16 max-phone:h-16',
  result: 'w-60 h-60 max-phone:w-48 max-phone:h-48',
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
  pokemon: Pick<PokemonSummary, 'nameKo' | 'nameEn' | 'names'> & { images?: Pick<PokemonImages, 'artworkUrl' | 'spriteUrl'> | null };
  size: 'small' | 'large' | 'result';
}) {
  const { locale, t: translate } = useI18n();
  const [failed, setFailed] = useState<string[]>([]);
  const source = (size === 'result' ? [pokemon.images?.artworkUrl, pokemon.images?.spriteUrl] : [pokemon.images?.spriteUrl])
    .map(safeImage)
    .find((url) => url && !failed.includes(url));
  const name = pokemonName({ ...pokemon, pokemonId: pokemon.nameEn }, locale);
  return source ? (
    <Image
      className={`object-contain shrink-0 ${imageSizes[size]}`}
      src={source}
      width={size === 'result' ? 240 : size !== 'small' ? 80 : 32}
      height={size === 'result' ? 240 : size !== 'small' ? 80 : 32}
      sizes={size === 'result' ? '(max-width: 480px) 192px, 240px' : size !== 'small' ? '80px' : '32px'}
      alt={size !== 'small' ? translate('{name} 이미지', { name }) : ''}
      loading={size !== 'small' ? 'eager' : 'lazy'}
      fetchPriority={size !== 'small' ? 'high' : 'auto'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed((old) => [...old, source])}
    />
  ) : (
    <span
      className={`inline-flex items-center justify-center text-muted shrink-0 ${imageSizes[size]}`}
      role={size !== 'small' ? 'img' : undefined}
      aria-label={size !== 'small' ? translate('{name} 이미지 없음', { name }) : undefined}
      aria-hidden={size === 'small' ? true : undefined}
    >
      <ImageOff size={size !== 'small' ? 24 : 14} />
    </span>
  );
}
