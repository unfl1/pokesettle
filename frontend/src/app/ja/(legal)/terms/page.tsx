import Document from '../../../../components/legal/TermsDocument';
import { legalMetadata } from '../../../../components/legal/metadata';

export function generateMetadata() { return legalMetadata('ja', 'terms'); }
export default function Page() { return <Document locale="ja" />; }
