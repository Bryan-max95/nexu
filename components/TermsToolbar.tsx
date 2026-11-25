'use client';
import { Printer } from 'lucide-react';

export default function TermsToolbar() {
  return <button type="button" onClick={()=>window.print()} className="terms-toolbar inline-flex items-center gap-2 text-sm font-semibold text-[#7A1C24] rounded-lg bg-white border border-neutral-200 px-4 py-3 hover:border-[#7A1C24]"><Printer className="w-4 h-4" aria-hidden="true"/>Imprimir o guardar como PDF</button>;
}
