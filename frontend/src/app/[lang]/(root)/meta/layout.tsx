import type { ReactNode } from 'react';
import RouteBoundary from '../../../../components/layout/RouteBoundary';

export default function MetagameLayout({ children }: { children: ReactNode }) {
  return <RouteBoundary>{children}</RouteBoundary>;
}
