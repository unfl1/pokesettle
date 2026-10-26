import type { Metadata } from 'next';
import ChatWorkspace from '../../../features/chat/components/ChatWorkspace';

export const metadata: Metadata = { title: '챗봇' };

export default function Page() {
  return <ChatWorkspace />;
}
