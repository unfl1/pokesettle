import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, localeRegistry, locales } from '../../i18n/config';
import { getDictionary } from '../../i18n/server';
import { I18nProvider } from '../../i18n/I18nProvider';
import { siteUrl } from '../../i18n/metadata';
import { connection } from 'next/server';
import { GoogleAnalytics } from '@next/third-parties/google';
import { pretendard } from '../fonts';
import { AppProviders } from '../../providers/AppProviders';
import '../pretendard-subsets.css';
import '../../globals.css';

export const metadata: Metadata = { metadataBase: new URL(siteUrl) };
export function generateStaticParams() {
  return locales.map(lang => ({ lang }));
}
export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dictionary = await getDictionary(lang);
  // Read the deployment measurement ID at request time, after the image is built.
  await connection();
  const gaId = process.env.GA_ID;
  return (
    <html lang={localeRegistry[lang].htmlLang} style={{ scrollbarGutter: 'stable' }} className={`${pretendard.variable} font-sans text-ink bg-canvas`}>
      <body>
        <I18nProvider locale={lang} dictionary={dictionary}><AppProviders>{children}</AppProviders></I18nProvider>
        {gaId && /^G-[A-Z0-9]+$/.test(gaId) && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
