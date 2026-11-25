import type { Metadata } from 'next';
import MarketingHome from '@/components/MarketingHome';
import { OFFICIAL_APP_URL } from '@/lib/app-origin';

export const metadata: Metadata = {
  alternates: { canonical: OFFICIAL_APP_URL },
  description: 'Explora BWP NEXO: panel empresarial interactivo, documentos PDF de muestra, control CAI y correlativos, clientes, roles de equipo, planes y activacion para empresas en Honduras.',
};

export default function Home() { return <MarketingHome />; }
