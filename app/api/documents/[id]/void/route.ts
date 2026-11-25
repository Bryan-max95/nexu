import { databaseRoute } from '@/lib/database';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import { generateServerPdf } from '@/lib/pdf-generator';
import {
  appendAuditLog,
  checkRolePermission,
  getDb,
  persistDb,
  withTransactionLock,
} from '@/lib/server-store';

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, company, member } = requireCompanySession(req);
    if (!checkRolePermission(member.role, 'ANULAR')) {
      return NextResponse.json(
        {
          error:
            'Permiso denegado (403): Solo el Propietario tiene autorización para anular documentos fiscales.',
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();
    const reason = String(body.reason || '').trim();

    if (reason.length < 6) {
      return NextResponse.json(
        { error: 'Debe especificar un motivo legal válido para la anulación (mínimo 6 caracteres).' },
        { status: 422 }
      );
    }

    return await withTransactionLock(async () => {
      const db = getDb();
      const doc = db.documents.find((d) => d.id === id);

      if (!doc) {
        return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
      }
      if (doc.companyId !== company.id) {
        return NextResponse.json(
          { error: 'Acceso cruzado entre empresas denegado (403).' },
          { status: 403 }
        );
      }
      if (doc.status === 'ANULADO') {
        return NextResponse.json(
          { error: 'Este documento ya se encuentra anulado.' },
          { status: 409 }
        );
      }
      if (doc.status === 'BORRADOR') {
        return NextResponse.json(
          { error: 'Los borradores no tienen numeración fiscal emitida para anular.' },
          { status: 422 }
        );
      }

      const nowUtc = new Date().toISOString();
      doc.status = 'ANULADO';
      doc.cancellation = {
        reason,
        userId: session.userId,
        userName: session.name,
        cancelledAtUtc: nowUtc,
      };
      doc.snapshot.status = 'ANULADO';
      doc.snapshot.cancellationSnapshot = {
        reason,
        cancelledBy: session.name,
        cancelledAt: nowUtc,
      };

      // Regenerate PDF representation marked as ANULADO while keeping original data intact
      const pdfResult = generateServerPdf(doc.snapshot);
      doc.pdfHash = pdfResult.sha256Hash;
      doc.pdfVersion = (doc.pdfVersion || 1) + 1;

      // Record accounting reversal event (Section 15 & 28)
      db.integrationEvents.unshift({
        id: `iev-${crypto.randomUUID().slice(0, 8)}`,
        companyId: company.id,
        documentId: doc.id,
        fiscalNumber: doc.fiscalNumber,
        eventType: 'DOCUMENTO_ANULADO',
        payloadSummary: `Anulación de ${doc.docType} ${doc.fiscalNumber} · Motivo: ${reason} · Reversión L ${doc.totals.totalFiscal}`,
        externalReference: `ASIENTO-REV-${doc.fiscalNumber.slice(-4)}`,
        attempts: 1,
        status: 'CONCILIADO',
        updatedAtUtc: nowUtc,
      });

      appendAuditLog({
        companyId: company.id,
        actorId: session.userId,
        actorName: session.name,
        actorRole: member.role,
        operation: 'DOCUMENTO_ANULADO',
        entityType: 'document',
        entityId: doc.id,
        details: `Anulación controlada de ${doc.docType} ${doc.fiscalNumber}. Motivo: ${reason}. El correlativo permanece bloqueado y nunca es reutilizable.`,
      });

      persistDb();
      return NextResponse.json({
        document: doc,
        message: `Documento ${doc.fiscalNumber} anulado correctamente. Su correlativo nunca será reutilizado.`,
      });
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al anular documento.' },
      { status: e.status || 500 }
    );
  }
}

export const POST = databaseRoute(handlePOST);
