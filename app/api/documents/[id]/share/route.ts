import { databaseRoute } from '@/lib/database';
import { getAppOrigin } from '@/lib/app-origin';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import { formatCurrency } from '@/lib/fiscal-engine';
import { appendAuditLog, getDb, persistDb } from '@/lib/server-store';

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, company, member } = requireCompanySession(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'CREATE');
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

    if (action === 'REVOKE') {
      const linkId = String(body.linkId || '');
      const target = db.shareLinks.find(
        (s) => s.id === linkId && s.companyId === company.id && s.documentId === doc.id
      );
      if (!target) {
        return NextResponse.json({ error: 'Enlace no encontrado.' }, { status: 404 });
      }
      target.revoked = true;
      appendAuditLog({
        companyId: company.id,
        actorId: session.userId,
        actorName: session.name,
        actorRole: member.role,
        operation: 'ENLACE_PRIVADO_REVOCADO',
        entityType: 'document_share_link',
        entityId: target.id,
        details: `Revocación de enlace temporal para documento ${doc.fiscalNumber}.`,
      });
      persistDb();
      return NextResponse.json({
        revoked: true,
        shareLinks: db.shareLinks.filter((s) => s.companyId === company.id && s.documentId === doc.id),
      });
    }

    // Create random revocable & temporary token (stored hashed with SHA-256 in DB per Section 13 & 26)
    const rawToken = crypto.randomBytes(24).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const hoursValid = Math.min(168, Math.max(1, Number(body.hoursValid || 72)));
    const expiresAtUtc = new Date(Date.now() + hoursValid * 3600 * 1000).toISOString();

    const linkRecord = {
      id: `lnk-${crypto.randomUUID().slice(0, 8)}`,
      companyId: company.id,
      documentId: doc.id,
      tokenHash,
      tokenPreview: `${rawToken.slice(0, 6)}...${rawToken.slice(-4)}`,
      expiresAtUtc,
      revoked: false,
      createdByUserId: session.userId,
      createdAtUtc: new Date().toISOString(),
    };

    db.shareLinks.unshift(linkRecord);

    const origin = getAppOrigin();
    const privatePdfUrl = `${origin}/api/documents/${doc.id}/pdf?shareToken=${encodeURIComponent(rawToken)}`;

    // Exact WhatsApp message mandated in Section 13 (Page 11)
    const formattedTotal = formatCurrency(doc.totals.totalFiscal, doc.currency);
    const whatsappMessage = `Estimado cliente, gracias por confiar en nuestra empresa. Le compartimos su factura ${doc.fiscalNumber} por ${formattedTotal}. Puede visualizar y descargar su factura aquí: ${privatePdfUrl}. Gracias por su preferencia`;

    const cleanPhone = String(body.phone || doc.clientWhatsapp || doc.clientPhone || '')
      .replace(/[^\d]/g, '');
    const intlPhone =
      cleanPhone.length === 8 ? `504${cleanPhone}` : cleanPhone || '50499887766';
    const waMeUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    appendAuditLog({
      companyId: company.id,
      actorId: session.userId,
      actorName: session.name,
      actorRole: member.role,
      operation: 'ENLACE_COMPARTIDO_GENERADO',
      entityType: 'document_share_link',
      entityId: linkRecord.id,
      details: `Enlace privado temporal (${hoursValid}h) generado para ${doc.fiscalNumber}. (Nota: Abrir WhatsApp no declara lectura por destinatario).`,
    });

    persistDb();

    return NextResponse.json({
      shareLink: linkRecord,
      privatePdfUrl,
      whatsappMessage,
      waMeUrl,
      intlPhone,
      shareLinks: db.shareLinks.filter((s) => s.companyId === company.id && s.documentId === doc.id),
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al generar enlace privado.' },
      { status: e.status || 500 }
    );
  }
}

export const POST = databaseRoute(handlePOST);
