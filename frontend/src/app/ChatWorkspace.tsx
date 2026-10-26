"use client";
import { useWorkspaceContext } from './providers';
import ChatPanel from '../features/chat/components/ChatPanel';
export default function ChatWorkspace() {
  const workspace = useWorkspaceContext();
  return <div data-testid="chat-page"><ChatPanel workspace={workspace} /></div>;
}
