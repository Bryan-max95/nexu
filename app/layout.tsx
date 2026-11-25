import type {Metadata} from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { OFFICIAL_APP_URL } from '@/lib/app-origin';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(OFFICIAL_APP_URL),
  title: 'BWP NEXO — Sistema Web de Facturación Fiscal',
  description: 'Plataforma SaaS multiempresa de facturación fiscal para autoimpresores en Honduras. Control CAI, correlativos, tres plantillas PDF, WhatsApp y superadministración BWP.',
  openGraph: {
    url: OFFICIAL_APP_URL,
    title: 'BWP NEXO — Sistema Web de Facturación Fiscal',
    description: 'Plataforma SaaS multiempresa de facturación fiscal para autoimpresores en Honduras. Control CAI, correlativos, tres plantillas PDF, WhatsApp y superadministración BWP.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BWP NEXO — Sistema Web de Facturación Fiscal',
    description: 'Plataforma SaaS multiempresa de facturación fiscal para autoimpresores en Honduras. Control CAI, correlativos, tres plantillas PDF, WhatsApp y superadministración BWP.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es" className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="font-sans bg-[#FAFAFA] text-[#141414] antialiased selection:bg-[#7A1C24] selection:text-white">
        {children}
      </body>
    </html>
  );
}
