"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { withoutLocale } from '../i18n/config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeamDraft } from '../features/team/hooks/useTeamDraft';
import { useWorkspace } from '../features/chat/hooks/useWorkspace';
import { saveNavigationDraft, takeNavigationDraft } from '../lib/navigationDraft';

type Workspace = ReturnType<typeof useWorkspace> & { enableDiscovery: (enabled?: boolean) => void };
const WorkspaceContext = createContext<Workspace | null>(null);
const TeamDraftContext = createContext<ReturnType<typeof useTeamDraft> | null>(null);
export function useTeamDraftContext() {
  const draft = useContext(TeamDraftContext);
  if (!draft) throw new Error("WorkspaceProvider is required");
  return draft;
}
function WorkspaceProvider({ children }: { children: ReactNode }) {
  const path = withoutLocale(usePathname());
  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);
  useEffect(() => { if (!path.startsWith('/pokedex')) setDiscoveryEnabled(false); }, [path]);
  const chatEnabled = path === '/chat';
  const sessionEnabled = chatEnabled || path === '/scenario' || (path.startsWith('/pokedex') && discoveryEnabled);
  const workspace = useWorkspace('', chatEnabled, sessionEnabled);
  const teamDraft = useTeamDraft();
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const initial = takeNavigationDraft();
    if (!initial) return;
    // Restore state in place: remounting this provider replaces links during a click.
    workspace.setDraft(initial.draft);
    teamDraft.restore(initial.team);
  }, [workspace, teamDraft]);
  useLayoutEffect(() => {
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
  return <WorkspaceContext.Provider value={{ ...workspace, enableDiscovery: (enabled = true) => setDiscoveryEnabled(enabled) }}><TeamDraftContext.Provider value={teamDraft}>{children}</TeamDraftContext.Provider></WorkspaceContext.Provider>;
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
