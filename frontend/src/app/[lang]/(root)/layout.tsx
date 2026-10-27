import type { ReactNode } from 'react';
import WorkspaceShell from '../../../components/layout/WorkspaceShell';

export default function RootGroupLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
