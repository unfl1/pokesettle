import { pageMetadata } from '../../../../i18n/metadata';

export default function Page() { return null; }
export async function generateMetadata() {
  return pageMetadata('/pobti', '포BTI', '모험 속 12가지 선택으로 나의 성향과 어울리는 포켓몬을 만나 보세요.');
}
