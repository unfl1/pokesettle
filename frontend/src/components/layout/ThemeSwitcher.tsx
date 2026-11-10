'use client';

import { useLayoutEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { themeStorageKey } from './ThemeScript';

type Theme = 'light' | 'dark';

export default function ThemeSwitcher() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>('light');
  const [storageFailed, setStorageFailed] = useState(false);

  useLayoutEffect(() => {
    const apply = (value: string | null) => {
      const next = value === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    try {
      apply(localStorage.getItem(themeStorageKey));
    } catch {
      apply(document.documentElement.dataset.theme ?? null);
    }
    const sync = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === themeStorageKey || event.key === null))
        apply(event.newValue);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function selectTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(themeStorageKey, next);
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        role="switch"
        aria-label={t('다크 모드')}
        aria-checked={theme === 'dark'}
        title={t(theme === 'dark' ? '라이트 모드' : '다크 모드')}
        onClick={() => selectTheme(theme === 'dark' ? 'light' : 'dark')}
        className="grid min-h-9 min-w-9 place-items-center rounded-[8px] border border-line bg-canvas text-muted hover:bg-accent-hover hover:text-accent aria-checked:text-accent"
      >
        {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      </button>
      {storageFailed && (
        <p
          role="status"
          className="absolute right-0 top-full z-30 mt-2 w-60 rounded-[8px] border border-line bg-surface p-3 text-[12px] text-ink shadow-lg"
        >
          {t('화면 모드를 저장할 수 없어요. 이번 페이지에서만 적용돼요.')}
        </p>
      )}
    </div>
  );
}
