"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeamDraft } from '../features/team/hooks/useTeamDraft';
import { useWorkspace } from '../features/chat/hooks/useWorkspace';
import { saveNavigationDraft, takeNavigationDraft, type NavigationDraft } from '../lib/navigationDraft';

const WorkspaceContext = createContext<ReturnType<typeof useWorkspace> | null>(null);
const TeamDraftContext = createContext<ReturnType<typeof useTeamDraft> | null>(null);
export function useTeamDraftContext() {
  const draft = useContext(TeamDraftContext);
  if (!draft) throw new Error("WorkspaceProvider is required");
  return draft;
}
function WorkspaceProvider({ children, initial }: { children: ReactNode; initial: NavigationDraft | null }) {
  const workspace = useWorkspace(initial?.draft);
  const teamDraft = useTeamDraft(initial?.team);
  useEffect(() => {
    const save = () => {
      const { own, opponent, name, selectedId, notice, tab, ownActive, opponentActive,
        attackTypes, megaUsed, megaTargetId, switchBlocked } = teamDraft;
      saveNavigationDraft({ draft: workspace.draft, team: {
        own, opponent, name, selectedId, notice, tab, ownActive, opponentActive,
        attackTypes, megaUsed, megaTargetId, switchBlocked,
      } });
    };
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [workspace.draft, teamDraft]);
  return <WorkspaceContext.Provider value={workspace}><TeamDraftContext.Provider value={teamDraft}>{children}</TeamDraftContext.Provider></WorkspaceContext.Provider>;
}
export function useWorkspaceContext() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('WorkspaceProvider is required');
  return workspace;
}
export function AppProviders({ children }: { children: ReactNode }) {
  const [initial, setInitial] = useState<NavigationDraft | null>(null);
  useEffect(() => setInitial(takeNavigationDraft()), []);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }));
  return <QueryClientProvider client={queryClient}><WorkspaceProvider key={initial ? 'restored' : 'fresh'} initial={initial}>{children}</WorkspaceProvider></QueryClientProvider>;
}
