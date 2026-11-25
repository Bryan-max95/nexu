import { databaseRoute } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, requireCompanySession } from '@/lib/api-auth';
import { issueOrDraftDocument } from '@/lib/server-store';

async function handlePOST(req: NextRequest) {
  try {
    const { session } = requireCompanySession(req);
    if (!enforceRateLimit(`issue:${session.companyId}`, 60, 60_000)) {
      return NextResponse.json(
        { error: 'Límite de velocidad de emisión alcanzado. Espere unos segundos.' },
        { status: 429 }
      );
    }

    const body = await req.json();

    const result = await issueOrDraftDocument({
      session,
      mode: 'EMITIR',
      idempotencyKey: body.idempotencyKey,
      draftId: body.draftId,
      docType: body.docType || 'FACTURA',
      currency: body.currency || 'HNL',
      paymentMethod: body.paymentMethod || 'EFECTIVO',
      paymentCondition: body.paymentCondition || 'Contado',
      taxIncluded: Boolean(body.taxIncluded),
      generalDiscount: body.generalDiscount ?? '0',
      retencionAmount: body.retencionAmount ?? '0',
      clientName: body.clientName || '',
      clientRtn: body.clientRtn || '',
      clientIdDoc: body.clientIdDoc || '',
      clientAddress: body.clientAddress || '',
      clientPhone: body.clientPhone || '',
      clientWhatsapp: body.clientWhatsapp || '',
      clientEmail: body.clientEmail || '',
      isFinalConsumer: Boolean(body.isFinalConsumer),
      exoneratedOrder: body.exoneratedOrder || '',
      exoneratedRegistry: body.exoneratedRegistry || '',
      exoneratedSag: body.exoneratedSag || '',
      relatedDocumentId: body.relatedDocumentId || undefined,
      relatedReason: body.relatedReason || '',
      templateUsed: body.templateUsed,
      paperSize: body.paperSize,
      items: body.items || [],
      simulatePdfFailure: Boolean(body.simulatePdfFailure),
    });

    return NextResponse.json({
      document: result.document,
      idempotentReplay: result.idempotentReplay,
      message: result.idempotentReplay
        ? 'Respuesta recuperada de clave idempotente (sin duplicar correlativo).'
        : 'Documento emitido y registrado fiscalmente con éxito.',
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al emitir documento fiscal.' },
      { status: e.status || 500 }
    );
  }
}

export const POST = databaseRoute(handlePOST);
