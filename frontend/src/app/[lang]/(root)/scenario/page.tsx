import { pageMetadata } from '../../../../i18n/metadata';

import { getI18n } from '../../../../i18n/server';
import { Suspense } from 'react';
import TeamWorkspace from '../../../../features/team/components/TeamWorkspace';
import SourceLanguageNote from '../../../../components/layout/SourceLanguageNote';

export default async function Page() {
  const { t: translate } = await getI18n();
  return <><SourceLanguageNote /><section className="page-intro [margin:24px_0_20px] p-6 border border-line rounded-[12px] bg-surface [&_h1]:text-[30px] [&_h1]:font-[750] [&_h1]:tracking-[-1.1px] [&_h1]:[margin:0_0_9px] [&_h1]:leading-[1.4] [&_h1]:text-ink [&_h2]:text-[30px] [&_h2]:font-[750] [&_h2]:tracking-[-1.1px] [&_h2]:[margin:0_0_9px] [&_h2]:leading-[1.4] [&_h2]:text-ink [&_p]:text-[#64748b] [&_p]:text-[14px] [&_p]:leading-[1.8] screen-780:[&_h1]:text-[26px] screen-780:[&_h2]:text-[26px] screen-540:mt-4 screen-540:py-5 screen-540:px-4 screen-540:[&_h1]:text-[24px] screen-540:[&_h1]:tracking-[-.9px] screen-540:[&_h2]:text-[24px] screen-540:[&_h2]:tracking-[-.9px] screen-540:[&_p]:text-[14px]" aria-labelledby="page-title"><h1 id="page-title">{translate("누구를 내보낼지, 먼저 골라보세요")}</h1><p>{translate("양쪽 팀을 추가하면 추천 3마리와 선봉을 확인할 수 있어요.")}</p></section><Suspense><div data-testid="scenario-page"><TeamWorkspace /></div></Suspense></>;
}

export async function generateMetadata() {
  return pageMetadata('/scenario', '6:6 시나리오', '양쪽 팀을 구성하고, 선출과 공격·교체 시나리오를 차근차근 비교해 보세요.');
}
