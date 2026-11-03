import { getI18n } from '../../i18n/server';

export default async function SourceLanguageNote() {
  const { locale, t } = await getI18n();
  return locale === 'ko' ? null : <p className="source-language-note">{t('자료와 답변은 한국어 중심이며, 수집된 원문은 번역하지 않고 표시해요.')}</p>;
}
