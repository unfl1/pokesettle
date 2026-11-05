import { notFound } from 'next/navigation';
import { isPobtiType, profiles } from '../../../../../features/pobti/model';
import { pageMetadata } from '../../../../../i18n/metadata';
import { getI18n } from '../../../../../i18n/server';

export function generateStaticParams() {
  return Object.keys(profiles).map(type => ({ type: type.toLowerCase() }));
}

export default async function Page({ params }: PageProps<'/[lang]/pobti/[type]'>) {
  const { type } = await params;
  if (!isPobtiType(type.toUpperCase())) notFound();
  return null;
}

export async function generateMetadata({ params }: PageProps<'/[lang]/pobti/[type]'>) {
  const { type } = await params;
  const key = type.toUpperCase();
  if (!isPobtiType(key)) notFound();
  const { t } = await getI18n();
  return pageMetadata(`/pobti/${type}`, `${key} · ${t(profiles[key].pokemon)} · ${t('포BTI')}`, profiles[key].title);
}
