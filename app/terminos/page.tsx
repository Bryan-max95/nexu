import type { Metadata } from 'next';
import TermsPrivacyContent from '@/components/TermsPrivacyContent';

export const metadata: Metadata = {
  title: 'Términos de uso y privacidad | BWP NEXO',
  description: 'Condiciones de uso, privacidad, datos de cuenta, sesiones y controles de seguridad del ecosistema BWP NEXO.',
  alternates: { canonical: '/terminos' },
};

export default function Terms() { return <TermsPrivacyContent />; }
