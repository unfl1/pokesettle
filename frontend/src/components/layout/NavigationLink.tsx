'use client';

import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/I18nProvider';

function NavigationPending() {
  const { pending } = useLinkStatus();
  const { t } = useI18n();
  return <>
    <span className="navigation-pending" data-pending={pending || undefined} aria-hidden="true" />
    {pending && createPortal(<div className="navigation-status" role="status">{t('화면을 불러오는 중…')}</div>, document.body)}
  </>;
}

export default function NavigationLink({ children, className = '', prefetch = true, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={prefetch} className={`navigation-link ${className}`}>
    {children}<NavigationPending />
  </Link>;
}
