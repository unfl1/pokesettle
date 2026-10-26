"use client";

import { createContext, useContext, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeamDraft } from '../features/team/hooks/useTeamDraft';
import { useWorkspace } from '../features/chat/hooks/useWorkspace';

const WorkspaceContext = createContext<ReturnType<typeof useWorkspace> | null>(null);
const TeamDraftContext = createContext<ReturnType<typeof useTeamDraft> | null>(null);
export function useTeamDraftContext() {
  const draft = useContext(TeamDraftContext);
  if (!draft) throw new Error("WorkspaceProvider is required");
  return draft;
}
function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  const teamDraft = useTeamDraft();
  return <WorkspaceContext.Provider value={workspace}><TeamDraftContext.Provider value={teamDraft}>{children}</TeamDraftContext.Provider></WorkspaceContext.Provider>;
}
export function useWorkspaceContext() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('WorkspaceProvider is required');
  return workspace;
}
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }));
  return <QueryClientProvider client={queryClient}><WorkspaceProvider>{children}</WorkspaceProvider></QueryClientProvider>;
}
