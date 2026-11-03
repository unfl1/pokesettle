'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';

export default function MetagameSelection({ action, children }: { action: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <form action={action} method="get" aria-busy={pending} onSubmit={event => {
    event.preventDefault();
    // Include the clicked button: FormData(form) alone omits its name/value.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    const params = new URLSearchParams();
    data.forEach((value, key) => { if (typeof value === 'string') params.append(key, value); });
    startTransition(() => router.push(`${action}?${params}`, { scroll: false }));
  }}>{children}</form>;
}
