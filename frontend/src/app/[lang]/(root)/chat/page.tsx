import { pageMetadata } from '../../../../i18n/metadata';
import ChatPanel from '../../../../features/chat/components/ChatPanel';
import SourceLanguageNote from '../../../../components/layout/SourceLanguageNote';

export default function Page() {
  return <><SourceLanguageNote /><div data-testid="chat-page"><ChatPanel /></div></>;
}

export async function generateMetadata() {
  return pageMetadata('/chat', '챗봇', '포켓몬 배틀 상황을 물어보면, 근거를 바탕으로 전략을 안내해요.');
}
