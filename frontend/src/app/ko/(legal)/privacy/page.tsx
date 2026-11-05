import Document from '../../../../components/legal/PrivacyDocument';
import { legalMetadata } from '../../../../components/legal/metadata';

export function generateMetadata() { return legalMetadata('ko', 'privacy'); }
export default function Page() { return <Document locale="ko" />; }
