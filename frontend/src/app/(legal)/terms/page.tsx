import Document from '../../../components/legal/TermsDocument';
import { legalMetadata } from '../../../components/legal/metadata';

export function generateMetadata() { return legalMetadata('en', 'terms'); }
export default function Page() { return <Document locale="en" />; }
