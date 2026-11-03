'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function RefreshButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className="text-accent" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? pendingLabel : label}</button>;
}
