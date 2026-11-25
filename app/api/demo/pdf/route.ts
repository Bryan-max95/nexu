import { NextRequest, NextResponse } from 'next/server';
import { createDemoDocument } from '@/lib/demo-document';
import { generateServerPdf, TemplateId } from '@/lib/pdf-generator';

// Public, fixed sample only. No account data, database writes or fiscal allocation.
export function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get('template') || 'CORPORATIVA';
  if (!['CLASICA', 'CORPORATIVA', 'MINIMALISTA'].includes(requested)) return NextResponse.json({ error: 'Plantilla de muestra inválida.' }, { status: 400 });
  const pdf = generateServerPdf(createDemoDocument(requested as TemplateId));
  return new NextResponse(new Uint8Array(pdf.buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="BWP_NEXO_MUESTRA.pdf"', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}
