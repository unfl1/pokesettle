import { useI18n } from '../../../i18n/I18nProvider';
import { useTypeLabels } from '../typeLabels';

import { typeColors, lightTextTypes } from '../typeColors';
export { typeColors } from '../typeColors';

export function TypeBadge({ type }: { type: string }) {
  const typeLabels = useTypeLabels();
  const { t: translate } = useI18n();
  return (
    <span
      className="inline-flex items-center px-2 py-1 text-[14px] font-semibold leading-[1.3] rounded-[4px] whitespace-nowrap"
      style={{ backgroundColor: typeColors[type] ?? '#8492a3', color: lightTextTypes.has(type) ? '#ffffff' : '#111923' }}
    >
      {typeLabels[type] ?? (type === 'unknown' ? translate('타입 미확인') : type)}
    </span>
  );
}
