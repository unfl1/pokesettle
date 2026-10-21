import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { PokemonSummary } from '../types';

const imageSizes = {
  small: 'w-8 h-8 max-phone:w-[23px] max-phone:h-[23px]',
  large: 'w-19.5 h-19.5 max-phone:w-16 max-phone:h-16',
};

type ImageSize = keyof typeof imageSizes;

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
  pokemon: PokemonSummary;
  size: ImageSize;
}) {
  const sprite = safeImage(pokemon.images?.spriteUrl);
  const artwork = size === 'large' ? safeImage(pokemon.images?.artworkUrl) : null;
  // Reset load/error state when a reused team slot receives another Pokémon.
  return (
    <ProgressiveImage
      key={JSON.stringify([pokemon.pokemonId, sprite, artwork, size])}
      sprite={sprite}
      artwork={artwork}
      name={pokemon.nameKo ?? pokemon.nameEn}
      size={size}
    />
  );
}

function ProgressiveImage({
  sprite,
  artwork,
  name,
  size,
}: {
  sprite: string | null;
  artwork: string | null;
  name: string;
  size: ImageSize;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [artworkLoaded, setArtworkLoaded] = useState(false);
  const preview = sprite && !failed.includes(sprite) ? sprite : null;
  const full = artwork && !failed.includes(artwork) ? artwork : null;
  const showArtwork = Boolean(full && artworkLoaded);
  const alt = size === 'large' ? `${name} 이미지` : '';
  const fail = (url: string) => setFailed((old) => [...old, url]);

  if (!preview && !full)
    return (
      <span
        className={`inline-flex items-center justify-center text-[#667c91] shrink-0 ${imageSizes[size]}`}
        role={size === 'large' ? 'img' : undefined}
        aria-label={size === 'large' ? `${name} 이미지 없음` : undefined}
        aria-hidden={size === 'small' ? true : undefined}
      >
        <ImageOff size={size === 'large' ? 24 : 14} />
      </span>
    );

  return (
    <span className={`relative inline-flex shrink-0 ${imageSizes[size]}`}>
      {preview && (
        <img
          className={`w-full h-full object-contain ${showArtwork ? 'opacity-0' : ''}`}
          src={preview}
          alt={showArtwork ? '' : alt}
          aria-hidden={showArtwork || undefined}
          loading={size === 'large' ? 'eager' : 'lazy'}
          fetchPriority={size === 'large' ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => fail(preview)}
        />
      )}
      {full && (
        <img
          className={`absolute inset-0 w-full h-full object-contain ${showArtwork ? '' : 'opacity-0'}`}
          src={full}
          alt={showArtwork || !preview ? alt : ''}
          aria-hidden={preview && !showArtwork ? true : undefined}
          loading="eager"
          fetchPriority={preview ? 'low' : 'high'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setArtworkLoaded(true)}
          onError={() => fail(full)}
        />
      )}
    </span>
  );
}
