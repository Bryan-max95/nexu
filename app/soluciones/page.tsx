import type { Metadata } from 'next';
import CorporatePage from '@/components/CorporatePage';
import SolutionsCatalog from '@/components/SolutionsCatalog';
export const metadata:Metadata={title:'Soluciones empresariales | BWP NEXO',alternates:{canonical:'/soluciones'},description:'Explora 16 capacidades de facturación, administración, control y acceso dentro de los siete módulos empresariales de BWP NEXO.'};
export default function Page(){return <CorporatePage active="/soluciones" eyebrow="Soluciones" title="Herramientas para cada parte de tu operación." description="Conoce el alcance de BWP NEXO: desde preparar un documento hasta organizar autorizaciones, colaboradores, clientes y pagos del servicio."><SolutionsCatalog/></CorporatePage>;}
