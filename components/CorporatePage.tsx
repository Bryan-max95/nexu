import Link from 'next/link';
import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';

const sections = [['Soluciones','/soluciones'],['Implementación','/implementacion'],['Recursos','/recursos'],['Seguridad','/seguridad'],['Empresa','/empresa'],['Contacto','/contacto']];
export default function CorporatePage({ title, eyebrow, description, active, children }: { title: string; eyebrow: string; description: string; active: string; children: React.ReactNode }) {
  return <div className="marketing-root bg-[#fafafa] text-[#24262a]"><MarketingNav/><main>
    <section className="corporate-hero"><div className="max-w-7xl mx-auto px-6 py-14 sm:py-20"><div className="text-sm text-neutral-500 mb-9 flex gap-3"><Link href="/" className="hover:text-[#7A1C24]">Inicio</Link><span aria-hidden="true">/</span><span>{eyebrow}</span></div><p className="section-kicker">BWP NEXO · {eyebrow}</p><h1 className="text-4xl sm:text-6xl font-display font-bold tracking-[-.045em] leading-[1.12] max-w-4xl mt-5 mb-7">{title}</h1><p className="text-lg sm:text-xl text-neutral-600 leading-relaxed max-w-3xl">{description}</p></div></section>
    <nav aria-label="Áreas de BWP NEXO" className="border-y border-neutral-200 bg-white"><div className="max-w-7xl mx-auto px-6 flex gap-7 overflow-x-auto whitespace-nowrap">{sections.map(([label, href])=><Link key={href} href={href} aria-current={active===href?'page':undefined} className={`py-5 text-sm font-semibold border-b-2 ${active===href?'text-[#7A1C24] border-[#7A1C24]':'border-transparent text-neutral-500 hover:text-neutral-900'}`}>{label}</Link>)}</div></nav>
    {children}
    {active!=='/contacto' && <section className="max-w-7xl mx-auto px-6 py-16"><div className="rounded-2xl bg-[#7A1C24] text-white p-8 sm:p-12 flex flex-col md:flex-row md:items-center justify-between gap-7"><div><p className="text-sm text-white/60 mb-3">Tu empresa tiene su propia forma de trabajar.</p><h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Conversemos sobre lo que necesitas.</h2></div><Link href="/contacto" className="shrink-0 bg-white text-[#7A1C24] rounded-xl py-4 px-7 text-center font-semibold">Consultar con BWP</Link></div></section>}
  </main><MarketingFooter/></div>;
}
