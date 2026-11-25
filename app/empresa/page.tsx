import type { Metadata } from 'next';
import CorporatePage from '@/components/CorporatePage';
import { CompanyContent } from '@/components/EnterpriseContent';
export const metadata:Metadata={title:'La empresa y el ecosistema BWP | BWP NEXO',alternates:{canonical:'/empresa'},description:'Conoce el enfoque de BWP, sus cuatro plataformas y la visión de Bryan Cárcamo, creador y CEO del ecosistema.'};
export default function Page(){return <CorporatePage active="/empresa" eyebrow="Empresa" title="Una visión tecnológica para distintas áreas de tu empresa." description="BWP NEXO forma parte de un ecosistema que reúne facturación, operación comercial, ciberseguridad y desarrollo de software."><CompanyContent/></CorporatePage>;}
