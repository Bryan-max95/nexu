import type { Metadata } from 'next';
import CorporatePage from '@/components/CorporatePage';
import { ResourcesContent } from '@/components/EnterpriseContent';
export const metadata:Metadata={title:'Centro de recursos y guías | BWP NEXO',alternates:{canonical:'/recursos'},description:'Guías de acceso, documentos, CAI, equipo, pagos y archivos PDF y CSV de muestra para conocer BWP NEXO.'};
export default function Page(){return <CorporatePage active="/recursos" eyebrow="Recursos" title="Información útil para trabajar con más claridad." description="Guías de uso, conceptos del panel y archivos de muestra para entender el proceso y preparar a tu equipo."><ResourcesContent/></CorporatePage>;}
