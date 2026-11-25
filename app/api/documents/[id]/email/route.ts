import { mailer, mailIdentity } from '@/lib/mailer';
import { generateServerPdf } from '@/lib/pdf-generator';
import { databaseRoute } from '@/lib/database';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import { appendAuditLog, getDb, persistDb } from '@/lib/server-store';

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, company, member } = requireCompanySession(req);
    const { id } = await context.params;
    const body = await req.json();
    const recipientEmail = String(body.email || '').trim();
    const confirmedRecipient = Boolean(body.confirmedRecipient);

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

    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json(
        { error: 'Debe proporcionar un correo electrónico de destinatario válido.' },
        { status: 422 }
      );
    }

    // Section 13: "Nunca enviar información a un número/destinatario sin confirmación"
    if (!confirmedRecipient) {
      return NextResponse.json(
        { error: 'Debe confirmar explícitamente el destinatario antes de despachar el correo.' },
        { status: 422 }
      );
    }

    const pdf = generateServerPdf({ ...doc.snapshot, status: doc.status });
    await mailer().sendMail({ from: mailIdentity(), to: recipientEmail, subject: `${doc.snapshot.docTypeLabel} ${doc.fiscalNumber}`, text: `Adjuntamos su documento ${doc.fiscalNumber}.\n\nBWP NEXO · https://bwpnexo.it.com`, attachments: [{ filename: pdf.filename, content: pdf.buffer, contentType: 'application/pdf' }] });
    const smtpDeliveryId = `SMTP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    appendAuditLog({
      companyId: company.id,
      actorId: session.userId,
      actorName: session.name,
      actorRole: member.role,
      operation: 'DESPACHO_CORREO_SMTP',
      entityType: 'document',
      entityId: doc.id,
      details: `Solicitud técnica de envío SMTP (${smtpDeliveryId}) con PDF adjunto (${doc.pdfFilename}) a ${recipientEmail}. Resultado técnico: Despachado a cola SMTP (sin asumir lectura por destinatario).`,
    });

    persistDb();

    return NextResponse.json({
      deliveryId: smtpDeliveryId,
      recipientEmail,
      technicalStatus: 'DESPACHADO_A_COLA_SMTP',
      message: `Documento enviado a ${recipientEmail} con PDF adjunto.`,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al registrar envío de correo.' },
      { status: e.status || 500 }
    );
  }
}

export const POST = databaseRoute(handlePOST);
