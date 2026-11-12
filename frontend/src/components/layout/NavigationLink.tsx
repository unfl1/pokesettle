'use client';

import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps } from 'react';

function NavigationPending() {
  const { pending } = useLinkStatus();
  return <span className="navigation-pending absolute [inset:auto_0_0] h-[3px] bg-accent opacity-0 pointer-events-none [&[data-pending]]:opacity-100" data-pending={pending || undefined} aria-hidden="true" />;
}

export default function NavigationLink({ children, className = '', prefetch = true, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={prefetch} className={`navigation-link relative ${className}`}>
    {children}<NavigationPending />
  </Link>;
}
