import { getI18n } from '../../../../i18n/server';
import RouteLoading from '../../../../components/layout/RouteLoading';
import type { ReactNode } from 'react';
import RouteBoundary from '../../../../components/layout/RouteBoundary';

export default async function MetagameLayout({ children }: { children: ReactNode }) {
  const { t } = await getI18n();
  return <RouteBoundary fallback={<RouteLoading description={t('최초 조회나 갱신 시 외부 자료를 확인하므로 잠시 걸릴 수 있어요.')} />}>{children}</RouteBoundary>;
}
