import type { ReactNode } from 'react';
import LegalLayout from '../../components/legal/LegalLayout';

export { metadata, viewport } from '../../components/legal/LegalLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return <LegalLayout locale="en">{children}</LegalLayout>;
}
