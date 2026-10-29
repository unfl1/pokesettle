import { useI18n } from '../../i18n/I18nProvider';

import { typeLabels } from './typeNames';
export { typeLabels } from './typeNames';

export function useTypeLabels() {
  const { t } = useI18n();
  return Object.fromEntries(Object.entries(typeLabels).map(([type, label]) => [type, t(label)]));
}
