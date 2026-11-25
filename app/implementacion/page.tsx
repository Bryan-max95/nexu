import type { Metadata } from 'next';
import CorporatePage from '@/components/CorporatePage';
import { ImplementationContent } from '@/components/EnterpriseContent';
export const metadata:Metadata={title:'Implementación y preparación | BWP NEXO',alternates:{canonical:'/implementacion'},description:'Prepara los datos de empresa, presentación documental, autorizaciones CAI, equipo y activación comercial para comenzar con BWP NEXO.'};
export default function Page(){return <CorporatePage active="/implementacion" eyebrow="Implementación" title="Una implementación comienza con información bien preparada." description="Organiza los datos y las decisiones que necesita tu cuenta. Esta ruta te ayuda a pasar del registro a una operación configurada y revisada."><ImplementationContent/></CorporatePage>;}
