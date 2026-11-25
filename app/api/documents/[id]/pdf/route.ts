import { databaseRoute } from '@/lib/database';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { extractSessionFromRequest, requireCompanySession } from '@/lib/api-auth';
import { generateServerPdf } from '@/lib/pdf-generator';
import { appendAuditLog, getDb, persistDb } from '@/lib/server-store';

async function handleGET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const shareToken = searchParams.get('shareToken');
    const copyMode = searchParams.get('copyMode') || 'ORIGINAL_Y_COPIA';
    const db = getDb();

    const doc = db.documents.find((d) => d.id === id);
    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }

    // Authorize either via private revocable shareToken OR authenticated company session
    if (shareToken) {
      const tokenHash = crypto.createHash('sha256').update(shareToken).digest('hex');
      const link = db.shareLinks.find(
        (s) => s.documentId === doc.id && s.tokenHash === tokenHash
      );
      if (!link) {
        return NextResponse.json(
          { error: 'Enlace compartido inválido o inexistente (403).' },
          { status: 403 }
        );
      }
      if (link.revoked) {
        return NextResponse.json(
          { error: 'Este enlace privado fue revocado por la empresa emisora (403).' },
          { status: 403 }
        );
      }
      if (new Date(link.expiresAtUtc).getTime() < Date.now()) {
        return NextResponse.json(
          { error: 'Este enlace privado temporal ha expirado (403).' },
          { status: 403 }
        );
      }
    } else {
      const session = extractSessionFromRequest(req);
      if (!session) {
        return NextResponse.json(
          { error: 'No autenticado (401): Se requiere sesión o enlace privado válido.' },
          { status: 401 }
        );
      }
      const member = db.companyMembers.find(
        (m) =>
          m.userId === session.userId &&
          m.companyId === session.companyId &&
          m.status === 'ACTIVO'
      );
      if (!member || doc.companyId !== member.companyId) {
        return NextResponse.json(
          { error: 'Acceso cruzado entre empresas denegado (403).' },
          { status: 403 }
        );
      }
    }

    // Generate PDF using the immutable snapshot stored at emission time (Section 7 & 12)
    // Reprinting or downloading never consumes another correlative number!
    const snapshotPayload = {
      ...doc.snapshot,
      status: doc.status,
      copyLabel:
        copyMode === 'COPIA'
          ? 'COPIA - OBLIGADO TRIBUTARIO EMISOR  |  La factura es beneficio de todos. Exíjala.'
          : 'ORIGINAL - CLIENTE / COPIA - OBLIGADO TRIBUTARIO EMISOR  |  La factura es beneficio de todos. Exíjala.',
      cancellationSnapshot: doc.cancellation
        ? {
            reason: doc.cancellation.reason,
            cancelledBy: doc.cancellation.userName,
            cancelledAt: doc.cancellation.cancelledAtUtc,
          }
        : null,
    };

    const { buffer, filename, sha256Hash } = generateServerPdf(snapshotPayload);

    if (doc.pdfStatus !== 'GENERADO') {
      doc.pdfStatus = 'GENERADO';
      doc.pdfHash = sha256Hash;
      doc.pdfFilename = filename;
      persistDb();
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-PDF-SHA256': sha256Hash,
        'Cache-Control': 'no-store, private',
      },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al generar o descargar PDF.' },
      { status: e.status || 500 }
    );
  }
}

// POST /api/documents/[id]/pdf -> Regenerate PDF if it failed after emission WITHOUT consuming another correlative (Section 12 & 25)
async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, company, member } = requireCompanySession(req);
    const { id } = await context.params;
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

    const pdfResult = generateServerPdf({
      ...doc.snapshot,
      status: doc.status,
      cancellationSnapshot: doc.cancellation
        ? {
            reason: doc.cancellation.reason,
            cancelledBy: doc.cancellation.userName,
            cancelledAt: doc.cancellation.cancelledAtUtc,
          }
        : null,
    });

    doc.pdfStatus = 'GENERADO';
    doc.pdfHash = pdfResult.sha256Hash;
    doc.pdfFilename = pdfResult.filename;
    doc.pdfVersion = (doc.pdfVersion || 1) + 1;

    appendAuditLog({
      companyId: company.id,
      actorId: session.userId,
      actorName: session.name,
      actorRole: member.role,
      operation: 'PDF_REGENERADO_SIN_CONSUMO',
      entityType: 'document',
      entityId: doc.id,
      details: `Regeneración de archivo PDF para documento ${doc.fiscalNumber} (Versión PDF v${doc.pdfVersion}, Hash SHA-256: ${doc.pdfHash.slice(0, 16)}...) sin consumir nuevo correlativo.`,
    });

    persistDb();
    return NextResponse.json({
      document: doc,
      message: `PDF regenerado exitosamente (${doc.pdfFilename}) conservando el correlativo ${doc.fiscalNumber}.`,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al regenerar PDF.' },
      { status: e.status || 500 }
    );
  }
}

export const GET = databaseRoute(handleGET);
export const POST = databaseRoute(handlePOST);
