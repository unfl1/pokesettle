"use client";
import { useI18n } from '../../../i18n/I18nProvider';
import { localizedPath } from '../../../i18n/config';
import { useRouter } from 'next/navigation';
import { useWorkspaceContext } from '../../../providers/AppProviders';
import TeamWorkspace from './TeamWorkspace';
export default function ScenarioWorkspace() {
  const { locale } = useI18n();
  const workspace = useWorkspaceContext();
  const router = useRouter();
  return <div data-testid="scenario-page"><TeamWorkspace sessionReady={workspace.session.isSuccess} onAsk={question => {
    if (question) workspace.setDraft(question);
    router.push(localizedPath(locale, '/chat'));
  }} /></div>;
}
