import type { Metadata } from 'next';
import CorporatePage from '@/components/CorporatePage';
import { SecurityContent } from '@/components/EnterpriseContent';
export const metadata:Metadata={title:'Seguridad, accesos y responsabilidades | BWP NEXO',alternates:{canonical:'/seguridad'},description:'Conoce los controles de acceso, verificación de correo, sesiones revocables, roles y entrega de documentos de BWP NEXO.'};
export default function Page(){return <CorporatePage active="/seguridad" eyebrow="Seguridad" title="Información empresarial con responsabilidades definidas." description="Conoce cómo se organiza el acceso a la plataforma y qué decisiones están en manos del propietario y de cada colaborador."><SecurityContent/></CorporatePage>;}
