import plugin from 'tailwindcss/plugin';
import subsets from './src/styles/pretendard-subsets.json' with { type: 'json' };

/* Pretendard 1.3.9 · SIL OFL 1.1 · docs/guides/DATA_SOURCES.md */
export default plugin(({ addBase }) => {
  for (const subset of subsets) {
    addBase({
      '@font-face': {
        fontFamily: 'Pretendard Variable',
        fontStyle: 'normal',
        fontDisplay: 'swap',
        fontWeight: '45 920',
        src: `url(${subset.file}) format('woff2-variations')`,
        unicodeRange: subset.unicodeRange,
      },
    });
  }
});
