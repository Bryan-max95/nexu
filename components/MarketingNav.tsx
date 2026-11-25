'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [['Soluciones', '/soluciones'], ['Recursos', '/recursos'], ['Empresa', '/empresa'], ['Planes', '/#planes'], ['Contacto', '/contacto']] as const;
export default function MarketingNav() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  return <>
    <div className="bg-[#26272b] text-neutral-300 text-xs"><div className="max-w-7xl mx-auto px-6 py-2.5 flex justify-between gap-5"><span>Una empresa BWP <span className="text-neutral-500 mx-2">/</span> Tecnología para tu empresa</span><a href="mailto:bwpsoporte@gmail.com" className="hidden sm:block hover:text-white">Conversemos sobre tu facturación</a></div></div>
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-neutral-200">
      <nav aria-label="Navegación principal" className="max-w-7xl mx-auto px-4 sm:px-6 h-[88px] flex items-center justify-between gap-3 sm:gap-6">
        <Link href="/" aria-label="BWP NEXO, inicio" className="shrink-0"><img src="/logo-bwp-nexo.png" alt="BWP NEXO" className="w-28 min-[380px]:w-36 sm:w-44 h-auto"/></Link>
        <div className="hidden lg:flex gap-7 text-sm font-medium text-neutral-600">{links.map(([label, href]) => <a href={href} key={href} className="hover:text-[#7A1C24] transition-colors">{label}</a>)}</div>
        <div className="flex gap-3 sm:gap-5 items-center"><Link href="/login" className="text-sm whitespace-nowrap font-semibold text-neutral-700 hover:text-[#7A1C24]">Iniciar sesión</Link><span className="hidden sm:block"><Link href="/registro" className="marketing-button-primary !py-3 !px-5 !text-sm">Crear mi cuenta</Link></span><button type="button" aria-expanded={open} aria-controls="marketing-mobile-menu" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen(!open)} className="lg:hidden border border-neutral-200 p-2.5 rounded-lg text-neutral-700">{open ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}</button></div>
      </nav>
      {open && <nav id="marketing-mobile-menu" aria-label="Navegación móvil" className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-neutral-200 shadow-lg px-6 pb-6 pt-2 max-h-[calc(100dvh-88px)] overflow-y-auto">{[...links, ['Implementación', '/implementacion'], ['Seguridad', '/seguridad'], ['Panel empresarial', '/#modulos'], ['Documentos y PDF', '/#plantillas'], ['Preguntas frecuentes', '/#preguntas']].map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)} className="block py-3 border-b border-neutral-100 text-neutral-700 text-base">{label}</a>)}<Link href="/registro" onClick={() => setOpen(false)} className="marketing-button-primary mt-5 w-full">Crear mi cuenta</Link></nav>}
    </header>
  </>;
}
