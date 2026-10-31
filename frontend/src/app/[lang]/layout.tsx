import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, localeRegistry, locales } from '../../i18n/config';
import { getDictionary } from '../../i18n/server';
import { I18nProvider } from '../../i18n/I18nProvider';
import { siteUrl } from '../../i18n/metadata';
import RuntimeAnalytics from '../../components/layout/RuntimeAnalytics';
import { pretendard } from '../fonts';
import { AppProviders } from '../../providers/AppProviders';
import '../pretendard-subsets.css';
import '../../globals.css';

export const viewport: Viewport = { themeColor: '#0057ff' };
export const metadata: Metadata = { metadataBase: new URL(siteUrl) };
export function generateStaticParams() {
  return locales.map(lang => ({ lang }));
}
export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dictionary = await getDictionary(lang);
  return (
    <html lang={localeRegistry[lang].htmlLang} style={{ scrollbarGutter: 'stable' }} className={`${pretendard.variable} font-sans text-ink bg-surface`}>
      <body>
        <I18nProvider locale={lang} dictionary={dictionary}><AppProviders>{children}</AppProviders></I18nProvider>
        <RuntimeAnalytics />
      </body>
    </html>
  );
}
