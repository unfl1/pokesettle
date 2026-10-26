"use client";
import { useWorkspaceContext } from '../../../providers/AppProviders';
import ChatPanel from './ChatPanel';
export default function ChatWorkspace() {
  const workspace = useWorkspaceContext();
  return <div data-testid="chat-page"><ChatPanel workspace={workspace} /></div>;
}
