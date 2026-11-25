import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, ExternalLink } from 'lucide-react';

export default function SecurityBrandSeal({ compact = false }: { compact?: boolean }) {
  return <div className={`security-brand-card ${compact ? 'security-brand-card-compact' : ''}`}>
    <div className="flex items-center justify-between gap-4 mb-5"><span className="text-xs font-semibold tracking-widest uppercase text-[#e2a8b5]">Ecosistema de ciberseguridad BWP</span><ShieldCheck className="w-5 h-5 shrink-0 text-white/35" aria-hidden="true"/></div>
    <div className="security-seal-stage"><Image src="/brand/bwp-pentesting-sello.png" width={1254} height={1254} sizes={compact?'210px':'280px'} quality={85} priority alt="Sello de marca BWP Pentesting: ciberseguridad del ecosistema BWP" className="security-seal-image"/></div>
    <div className="mt-6"><p className="text-white font-semibold text-lg mb-3">Seguridad con identidad BWP.</p><p className="text-neutral-400 text-sm leading-relaxed">El sello identifica a BWP Pentesting dentro del ecosistema de BWP NEXO. Consulta el alcance de los controles de acceso y protección de la información implementados en la plataforma.</p></div>
    <div className="flex flex-col sm:flex-row gap-3 mt-6"><Link href="/seguridad" className="text-sm font-semibold text-[#e8b2bd] underline underline-offset-4">Conocer los controles</Link><a href="https://bwpentesting.com" target="_blank" rel="noopener noreferrer" className="sm:ml-auto text-sm text-neutral-400 inline-flex items-center gap-1.5">BWP Pentesting<ExternalLink className="w-3.5 h-3.5" aria-hidden="true"/></a></div>
    <p className="text-xs leading-relaxed text-neutral-400 border-t border-white/10 pt-4 mt-5">Sello de identidad de marca. No equivale a una certificación independiente ni acredita por sí solo una auditoría de seguridad aprobada.</p>
  </div>;
}
