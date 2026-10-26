import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { GoogleAnalytics } from '@next/third-parties/google';
import { pretendard } from './fonts';
import './pretendard-subsets.css';
import '../styles.css';

export const metadata: Metadata = {
  title: { default: 'PokeTact', template: 'PokeTact · %s' },
  description: '포켓몬 도감과 문서 근거를 함께 확인하는 PokeTact',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Read the deployment measurement ID at request time, after the image is built.
  await connection();
  const gaId = process.env.GA_ID;
  return (
    <html lang="ko" className={`${pretendard.variable} font-sans text-ink bg-canvas`}>
      <body>
        {children}
        {gaId && /^G-[A-Z0-9]+$/.test(gaId) && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
