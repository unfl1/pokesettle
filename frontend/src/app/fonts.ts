import localFont from 'next/font/local';

// Common glyphs use next/font; official unicode-range CSS loads other glyphs on demand.
export const pretendard = localFont({
  src: '../../public/fonts/pretendard/PretendardVariable.subset.91.woff2',
  variable: '--font-pretendard',
  weight: '45 920',
  display: 'swap',
  preload: false,
  fallback: ['Pretendard Variable', 'Arial', 'sans-serif'],
  declarations: [{ prop: 'unicode-range', value: 'U+20-22, U+27-2a, U+2c-39, U+3a-3b, U+3f, U+41-4e, U+4f-5d, U+61-7b, U+7d, U+a0-a1, U+ab, U+ad-ae, U+b7, U+bb, U+bf, U+2013-2014, U+201c-201d, U+2122, U+ac00, U+ace0, U+ae30, U+b2e4, U+b85c, U+b9ac, U+c0ac, U+c2a4, U+c2dc, U+c774, U+c778, U+c9c0, U+d558' }],
});
