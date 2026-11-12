import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import ThemeSwitcher from '../../frontend/src/components/layout/ThemeSwitcher';
import { themeStorageKey } from '../../frontend/src/components/layout/ThemeScript';
import { I18nProvider } from '../../frontend/src/i18n/I18nProvider';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

function renderSwitcher() {
  render(
    <I18nProvider locale="ko" dictionary={{}}>
      <ThemeSwitcher />
    </I18nProvider>,
  );
  return screen.getByRole('switch', { name: '다크 모드' });
}

test('저장된 다크 모드를 복원하고 클릭하면 라이트 모드를 저장함', () => {
  localStorage.setItem(themeStorageKey, 'dark');
  const toggle = renderSwitcher();
  expect(toggle).toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

  fireEvent.click(toggle);
  expect(toggle).not.toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(localStorage.getItem(themeStorageKey)).toBe('light');
});

test('저장 실패 시 화면 전환과 오류 안내를 유지하고 다음 저장 성공 시 안내를 지움', () => {
  const toggle = renderSwitcher();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
    throw new DOMException('Storage blocked', 'SecurityError');
  });

  fireEvent.click(toggle);
  expect(toggle).toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByRole('status')).toHaveTextContent('화면 모드를 저장할 수 없어요. 이번 페이지에서만 적용돼요.');

  fireEvent.click(toggle);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(localStorage.getItem(themeStorageKey)).toBe('light');
});

test('다른 탭에서 저장한 화면 모드를 동기화함', () => {
  const toggle = renderSwitcher();
  fireEvent(window, new StorageEvent('storage', { key: themeStorageKey, newValue: 'dark', storageArea: localStorage }));
  expect(toggle).toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});
