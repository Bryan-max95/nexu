import Link from 'next/link';
import { OFFICIAL_APP_URL, OFFICIAL_APP_DOMAIN } from '@/lib/app-origin';

const groups = [
  { title: 'La plataforma', links: [['Soluciones', '/soluciones'], ['Panel empresarial', '/#modulos'], ['Documentos y PDF', '/#plantillas'], ['Planes y activación', '/#planes']] },
  { title: 'Conoce BWP', links: [['La empresa', '/empresa'], ['Implementación', '/implementacion'], ['Seguridad', '/seguridad'], ['Recursos y guías', '/recursos']] },
  { title: 'Tu cuenta', links: [['Registrar mi empresa', '/registro'], ['Iniciar sesión', '/login'], ['Recuperar mi acceso', '/recuperar'], ['Términos y privacidad', '/terminos']] },
];

export default function MarketingFooter() {
  return <footer className="bg-[#191a1e] text-neutral-400"><div className="max-w-7xl mx-auto px-6 pt-16 pb-10"><div className="grid sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-10 pb-12">
    <div><p className="text-white font-display font-bold text-2xl tracking-tight mb-4">BWP NEXO<span className="text-[#d895a4]">.</span></p><p className="text-sm leading-relaxed max-w-xs">Facturación, documentos y control empresarial en un mismo espacio de trabajo.</p><a href={OFFICIAL_APP_URL} className="inline-block text-[#e4acb7] text-sm font-semibold mt-5">{OFFICIAL_APP_DOMAIN}</a><Link href="/contacto" className="block text-sm text-white mt-5 underline underline-offset-4">Hablemos de tu empresa</Link><a href="mailto:bwpsoporte@gmail.com" className="block text-sm mt-3 break-all">bwpsoporte@gmail.com</a></div>
    {groups.map(group => <div key={group.title}><h2 className="footer-title">{group.title}</h2>{group.links.map(([label, href]) => <Link key={href} href={href} className="footer-link">{label}</Link>)}</div>)}
  </div><div className="border-t border-white/10 pt-7 flex flex-wrap justify-between gap-4 text-xs"><span>© {new Date().getFullYear()} BWP NEXO · Una empresa BWP</span><span>Una visión de Bryan Cárcamo · Ecosistema BWP</span></div></div></footer>;
}
