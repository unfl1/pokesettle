import { getI18n } from '../../i18n/server';
import SourceLanguageNote from '../../components/layout/SourceLanguageNote';
import MetagamePage from './MetagamePage';
import type { SinglesMeta } from './types';

export default async function MetagameContent({ data, selected }: { data: SinglesMeta | null; selected?: string }) {
  const { t: translate } = await getI18n();
  return <><section className="page-intro [margin:24px_0_20px] p-6 border border-line rounded-[12px] bg-surface [&_h1]:text-[30px] [&_h1]:font-[750] [&_h1]:tracking-[-1.1px] [&_h1]:[margin:0_0_9px] [&_h1]:leading-[1.4] [&_h1]:text-ink [&_h2]:text-[30px] [&_h2]:font-[750] [&_h2]:tracking-[-1.1px] [&_h2]:[margin:0_0_9px] [&_h2]:leading-[1.4] [&_h2]:text-ink [&_p]:text-muted [&_p]:text-[14px] [&_p]:leading-[1.8] max-tablet:[&_h1]:text-[26px] max-tablet:[&_h2]:text-[26px] screen-540:mt-4 screen-540:py-5 screen-540:px-4 screen-540:[&_h1]:text-[24px] screen-540:[&_h1]:tracking-[-.9px] screen-540:[&_h2]:text-[24px] screen-540:[&_h2]:tracking-[-.9px] screen-540:[&_p]:text-[14px]" aria-labelledby="page-title"><h1 id="page-title">{translate("싱글 메타 순위")}</h1><p>{translate("자주 쓰는 포켓몬과 주요 세팅을 출처·기준일과 함께 살펴보세요.")}</p></section><MetagamePage data={data} selected={selected} /><SourceLanguageNote /></>;
}
