import Image from 'next/image';
import { ExternalLink } from 'lucide-react';

export default function SecurityBrandSeal({ floating = false }: { floating?: boolean }) {
  const size = floating ? 56 : 72;
  return (
    <a
      href="https://bwpentesting.com"
      target="_blank"
      rel="noopener noreferrer"
      className={floating ? 'security-seal-floating' : 'security-seal-signature'}
      aria-label="Sello de ciberseguridad. Visitar BWP Pentesting (abre en otra pestaña)"
      title="Visitar BWP Pentesting (abre en otra pestaña)"
    >
      <Image src="/brand/bwp-pentesting-sello.png" width={size} height={size} alt="" />
      {!floating && (
        <span>
          <span className="block text-xs font-medium text-neutral-500">Sello de ciberseguridad</span>
          <span className="mt-1 flex items-center gap-2 font-semibold text-[#7A1C24]">
            BWP Pentesting <ExternalLink size={14} aria-hidden="true" />
          </span>
        </span>
      )}
    </a>
  );
}
