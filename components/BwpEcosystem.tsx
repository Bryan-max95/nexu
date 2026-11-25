import { Code2, ShieldCheck, Store, FileText } from 'lucide-react';

const platforms = [
  { name: 'BWP NEXO', category: 'Facturación fiscal', description: 'El espacio de trabajo para organizar empresas, clientes y documentos fiscales.', href: 'https://bwpnexo.it.com', domain: 'bwpnexo.it.com', icon: FileText },
  { name: 'BWP Pentesting', category: 'Ciberseguridad', description: 'La seguridad de BWP NEXO está a cargo de BWP Pentesting, nuestra plataforma de ciberseguridad.', href: 'https://bwpentesting.com', domain: 'bwpentesting.com', icon: ShieldCheck },
  { name: 'BWP Retail POS', category: 'Facturación profesional y punto de venta', description: 'Conoce nuestro sistema de facturación profesional y punto de venta para la operación comercial.', href: 'https://bwpretailpos.com', domain: 'bwpretailpos.com', icon: Store },
  { name: 'BWP Software', category: 'Desarrollo profesional', description: 'Desarrollo de software y soluciones digitales profesionales para las necesidades de tu empresa.', href: 'https://bwpsoftware.com', domain: 'bwpsoftware.com', icon: Code2 },
];

export default function BwpEcosystem() {
  return <section id="ecosistema-bwp" aria-labelledby="bwp-title" className="bg-[#202125] text-white py-20 sm:py-24">
    <div className="max-w-7xl mx-auto px-6">
      <div className="max-w-2xl mb-12">
        <p className="text-[#e397a1] text-sm font-bold tracking-widest uppercase">Una empresa BWP</p>
        <h2 id="bwp-title" className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight mt-4 mb-6">Cuatro plataformas.<br/>Una misma visión.</h2>
        <p className="text-neutral-300 text-lg leading-relaxed">BWP NEXO forma parte de BWP: un ecosistema que reúne facturación, comercio, ciberseguridad y desarrollo de software para impulsar a las empresas.</p>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {platforms.map(({ name, category, description, href, domain, icon: Icon }) => <a key={name} href={href} {...(href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="group flex flex-col rounded-2xl border border-white/15 bg-white/[0.035] p-6 sm:p-7 hover:bg-white/[0.07] hover:border-[#c56b78] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e397a1]">
          <Icon className="w-7 h-7 text-[#e397a1] mb-7" aria-hidden="true"/>
          <p className="text-sm text-neutral-400 mb-2">{category}</p>
          <h3 className="text-xl font-bold mb-4">{name}</h3>
          <p className="text-neutral-300 leading-relaxed mb-7 flex-1">{description}</p>
          <span className="text-sm font-semibold text-[#f0aab4] underline underline-offset-4 decoration-white/20 group-hover:decoration-[#f0aab4]">{domain}</span>
        </a>)}
      </div>
      <div className="mt-12 pt-10 border-t border-white/15 flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-[#7A1C24] flex items-center justify-center text-2xl font-bold shrink-0" aria-hidden="true">BC</div>
        <div><p className="text-sm text-neutral-400 mb-2">Fundador y CEO del ecosistema BWP</p><h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Bryan Cárcamo</h3><p className="text-neutral-300 leading-relaxed mt-3 max-w-2xl">Creador de BWP NEXO y CEO de BWP NEXO, BWP Pentesting, BWP Retail POS y BWP Software. Una visión compartida de tecnología, seguridad y herramientas profesionales para las empresas.</p></div>
      </div>
    </div>
  </section>;
}
