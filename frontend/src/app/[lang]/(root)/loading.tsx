import { getI18n } from '../../../i18n/server';
export default async function Loading() {
  const { t: translate } = await getI18n();
  return <p role="status" className="py-10 text-muted">{translate("화면을 불러오고 있어요.")}</p>;
}
