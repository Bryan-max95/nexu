import { validateAttachment } from '@/lib/attachments';
import { databaseRoute } from '@/lib/database';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import {
  appendAuditLog,
  checkRolePermission,
  getDb,
  persistDb,
  SubscriptionPaymentRecord,
} from '@/lib/server-store';

async function handlePOST(req: NextRequest) {
  try {
    const { session, company, member } = requireCompanySession(req);
    if (!checkRolePermission(member.role, 'GESTIONAR_USUARIOS_SUSCRIPCION')) {
      return NextResponse.json(
        { error: 'Permiso denegado (403): Solo el Propietario puede registrar comprobantes de suscripción.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const paymentType =
      body.paymentType === 'ACTIVACION_UNICA' ? 'ACTIVACION_UNICA' : 'MENSUALIDAD';
    const bankReference = String(body.bankReference || '').trim().toUpperCase();
    const bankName = String(body.bankName || 'BAC Credomatic Honduras').trim();
    const receiptFilename = String(body.receiptFilename || 'Comprobante_Transferencia.pdf').trim();
    const notes = String(body.notes || '').trim();

    if (!bankReference || bankReference.length < 4) {
      return NextResponse.json(
        { error: 'Debe indicar el número de referencia bancaria del comprobante.' },
        { status: 422 }
      );
    }

    const db = getDb();

    // Prevent duplicate submission of the exact same bank reference (Section 4)
    if (
      db.subscriptionPayments.some(
        (p) =>
          p.bankReference.toUpperCase() === bankReference &&
          p.status !== 'RECHAZADO'
      )
    ) {
      return NextResponse.json(
        {
          error: `La referencia bancaria ${bankReference} ya fue registrada anteriormente. No se permite duplicar un mismo comprobante.`,
        },
        { status: 409 }
      );
    }

    const amountHnl =
      paymentType === 'ACTIVACION_UNICA'
        ? db.systemConfig.activationPriceHnl
        : db.systemConfig.monthlyPriceHnl;

    const newPayment: SubscriptionPaymentRecord = {
      id: `pay-${crypto.randomUUID().slice(0, 8)}`,
      companyId: company.id,
      companyName: company.commercialName,
      companyRtn: company.rtn,
      paymentType,
      amountHnl,
      bankReference,
      bankName,
      receiptFilename,
      receiptDataUrl: validateAttachment(body.receiptDataUrl),
      notes,
      status: 'PENDIENTE',
      createdAtUtc: new Date().toISOString(),
    };

    db.subscriptionPayments.unshift(newPayment);

    appendAuditLog({
      companyId: company.id,
      actorId: session.userId,
      actorName: session.name,
      actorRole: member.role,
      operation: 'COMPROBANTE_PAGO_SUBIDO',
      entityType: 'subscription_payment',
      entityId: newPayment.id,
      details: `Registro de comprobante ${paymentType} por L ${amountHnl} (${bankName}, Ref: ${bankReference}). Pendiente de verificación por Superadministrador BWP.`,
    });

    persistDb();

    return NextResponse.json({
      payment: newPayment,
      message:
        'Comprobante enviado correctamente. El Superadministrador BWP verificará y aprobará su pago.',
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al registrar comprobante.' },
      { status: e.status || 500 }
    );
  }
}

export const POST = databaseRoute(handlePOST);
