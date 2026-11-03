'use client';

import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/I18nProvider';

function NavigationPending() {
  const { pending } = useLinkStatus();
  const { t } = useI18n();
  return <>
    <span className="navigation-pending absolute [inset:auto_0_0] h-[3px] bg-accent opacity-0 pointer-events-none [&[data-pending]]:opacity-100" data-pending={pending || undefined} aria-hidden="true" />
    {pending && createPortal(<div className="navigation-status fixed bottom-6 left-[50%] [transform:translateX(-50%)] z-100 py-3 px-5 border border-line rounded-[12px] bg-surface text-ink shadow-[0_4px_16px_#0001] whitespace-nowrap pointer-events-none" role="status">{t('화면을 불러오는 중…')}</div>, document.body)}
  </>;
}

export default function NavigationLink({ children, className = '', prefetch = true, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={prefetch} className={`navigation-link relative ${className}`}>
    {children}<NavigationPending />
  </Link>;
}
