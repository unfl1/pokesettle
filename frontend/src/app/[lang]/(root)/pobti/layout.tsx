import type { ReactNode } from 'react';
import SourceLanguageNote from '../../../../components/layout/SourceLanguageNote';
import PobtiPage from '../../../../features/pobti/PobtiPage';

export default function Layout({ children }: { children: ReactNode }) {
  return <><SourceLanguageNote /><PobtiPage />{children}</>;
}
