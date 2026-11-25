import { databaseRoute } from '@/lib/database';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/api-auth';
import { getHondurasDateString } from '@/lib/fiscal-engine';
import {
  appendAuditLog,
  getDb,
  persistDb,
  SubscriptionStatus,
  withTransactionLock,
} from '@/lib/server-store';

async function handleGET(req: NextRequest) {
  try {
    requireSuperAdminSession(req);
    const db = getDb();

    // Superadmin has visibility into commercial status, payments, companies, and audit logs
    // Section 18: "No permitir modificar facturas emitidas ni acceder indiscriminadamente a datos privados."
    const companiesSummary = db.companies.map((c) => {
      const sub = db.subscriptions.find((s) => s.companyId === c.id);
      const emittedCount = db.documents.filter(
        (d) => d.companyId === c.id && d.status === 'EMITIDO'
      ).length;
      const activeCais = db.fiscalAuthorizations.filter(
        (a) => a.companyId === c.id && a.status === 'ACTIVO'
      ).length;
      const membersCount = db.companyMembers.filter(
        (m) => m.companyId === c.id && m.status === 'ACTIVO'
      ).length;

      return {
        id: c.id,
        legalName: c.legalName,
        commercialName: c.commercialName,
        rtn: c.rtn,
        department: c.department,
        municipality: c.municipality,
        email: c.email,
        whatsapp: c.whatsapp,
        representative: c.representative,
        createdAtUtc: c.createdAtUtc,
        subscription: sub || null,
        emittedCount,
        activeCais,
        membersCount,
      };
    });

    const activeCompaniesCount = db.subscriptions.filter(
      (s) => s.status === 'ACTIVA' || s.status === 'PROXIMA_A_VENCER'
    ).length;
    const pendingActivationsCount = db.subscriptions.filter(
      (s) => s.status === 'PENDIENTE_ACTIVACION'
    ).length;
    const expiredCompaniesCount = db.subscriptions.filter(
      (s) => s.status === 'VENCIDA' || s.status === 'SUSPENDIDA'
    ).length;

    const approvedPayments = db.subscriptionPayments.filter((p) => p.status === 'APROBADO');
    const totalApprovedRevenue = approvedPayments.reduce(
      (acc, p) => acc + (Number(p.amountHnl) || 0),
      0
    );

    return NextResponse.json({
      dashboard: {
        totalCompanies: db.companies.length,
        activeCompaniesCount,
        pendingActivationsCount,
        expiredCompaniesCount,
        totalApprovedRevenue: totalApprovedRevenue.toFixed(2),
        monthlyRecurringRunRate: (
          activeCompaniesCount * Number(db.systemConfig.monthlyPriceHnl)
        ).toFixed(2),
      },
      companies: companiesSummary,
      payments: db.subscriptionPayments,
      users: db.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        whatsapp: u.whatsapp,
        emailVerified: u.emailVerified,
        isSuperAdmin: u.isSuperAdmin,
        mfaEnabled: u.mfaEnabled,
        createdAtUtc: u.createdAtUtc,
      })),
      auditLogs: db.auditLogs.slice(0, 100),
      supportTickets: db.supportTickets,
      systemConfig: {
        activationPriceHnl: db.systemConfig.activationPriceHnl,
        monthlyPriceHnl: db.systemConfig.monthlyPriceHnl,
        graceDays: db.systemConfig.graceDays,
        pricesIncludeTax: db.systemConfig.pricesIncludeTax,
        bankInstructions: db.systemConfig.bankInstructions,
        supportWhatsapp: db.systemConfig.supportWhatsapp,
        supportEmail: db.systemConfig.supportEmail,
        honorariosEnabled: db.systemConfig.honorariosEnabled,
      },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error en panel superadministrador.' },
      { status: e.status || 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const adminSession = requireSuperAdminSession(req);
    const body = await req.json();
    const action = String(body.action || 'REVIEW_PAYMENT');

    return await withTransactionLock(async () => {
      const db = getDb();

      // 1. Approve or reject payment (Section 4 & 18: "Evitar aprobar dos veces un mismo pago")
      if (action === 'REVIEW_PAYMENT') {
        const paymentId = String(body.paymentId || '');
        const decision = body.decision === 'APROBAR' ? 'APROBADO' : 'RECHAZADO';
        const rejectionReason = String(body.rejectionReason || '').trim();

        const payment = db.subscriptionPayments.find((p) => p.id === paymentId);
        if (!payment) {
          return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 });
        }

        if (payment.status === 'APROBADO') {
          return NextResponse.json(
            {
              error:
                'Bloqueo de seguridad (409): Este pago ya fue aprobado anteriormente. No se permite aprobar dos veces un mismo pago.',
            },
            { status: 409 }
          );
        }

        if (decision === 'RECHAZADO' && !rejectionReason) {
          return NextResponse.json(
            { error: 'Debe especificar el motivo del rechazo del comprobante.' },
            { status: 422 }
          );
        }

        payment.status = decision;
        payment.reviewedBy = adminSession.name;
        payment.reviewedAtUtc = new Date().toISOString();
        if (decision === 'RECHAZADO') {
          payment.rejectionReason = rejectionReason;
        }

        const sub = db.subscriptions.find((s) => s.companyId === payment.companyId);
        if (sub && decision === 'APROBADO') {
          const today = getHondurasDateString();
          const [y, m, d] = today.split('-').map(Number);
          const nextMonthDate = new Date(Date.UTC(y, m, d)); // +1 month
          const nextYyyyMmDd = nextMonthDate.toISOString().slice(0, 10);

          if (payment.paymentType === 'ACTIVACION_UNICA') {
            sub.activationPaid = true;
          }
          sub.status = 'ACTIVA';
          sub.currentPeriodStart = today;
          sub.nextPaymentDate = nextYyyyMmDd;
          sub.updatedAtUtc = new Date().toISOString();

          db.notifications.unshift({
            id: `notif-${crypto.randomUUID().slice(0, 8)}`,
            companyId: payment.companyId,
            dedupKey: `${payment.companyId}:PAGO_APROBADO:${payment.id}`,
            type: 'PAGO',
            severity: 'INFO',
            title:
              payment.paymentType === 'ACTIVACION_UNICA'
                ? 'Cuenta empresarial activada (L 4,000.00 aprobados)'
                : 'Mensualidad L 350.00 aprobada y suscripción renovada',
            message: `Su comprobante ${payment.bankReference} por L ${payment.amountHnl} fue verificado y aprobado por BWP Software. Próximo vencimiento: ${nextYyyyMmDd}.`,
            channel: 'PANEL_Y_CORREO',
            deliveryStatus: 'ENTREGADO',
            read: false,
            createdAtUtc: new Date().toISOString(),
          });
        }

        appendAuditLog({
          companyId: payment.companyId,
          actorId: adminSession.userId,
          actorName: adminSession.name,
          actorRole: 'SUPERADMIN',
          operation: decision === 'APROBADO' ? 'PAGO_APROBADO' : 'PAGO_RECHAZADO',
          entityType: 'subscription_payment',
          entityId: payment.id,
          details: `${decision} de comprobante ${payment.paymentType} (L ${payment.amountHnl}, Ref: ${payment.bankReference}) para ${payment.companyName}.${decision === 'RECHAZADO' ? ` Motivo: ${rejectionReason}` : ''}`,
        });

        persistDb();
        return NextResponse.json({
          payment,
          subscription: sub,
          message:
            decision === 'APROBADO'
              ? `Pago ${payment.bankReference} aprobado y suscripción activada.`
              : `Pago ${payment.bankReference} rechazado con motivo registrado.`,
        });
      }

      // 2. Change company subscription status (Activar, Suspender, Renovar)
      if (action === 'SET_COMPANY_STATUS') {
        const companyId = String(body.companyId || '');
        const newStatus = body.status as SubscriptionStatus;
        const justification = String(body.justification || 'Gestión comercial BWP').trim();

        const sub = db.subscriptions.find((s) => s.companyId === companyId);
        if (!sub) {
          return NextResponse.json({ error: 'Suscripción no encontrada.' }, { status: 404 });
        }

        sub.status = newStatus;
        if (newStatus === 'ACTIVA') {
          sub.activationPaid = true;
          const today = getHondurasDateString();
          const [y, m, d] = today.split('-').map(Number);
          const nextMonthDate = new Date(Date.UTC(y, m, d));
          sub.nextPaymentDate = nextMonthDate.toISOString().slice(0, 10);
        }
        sub.updatedAtUtc = new Date().toISOString();

        appendAuditLog({
          companyId,
          actorId: adminSession.userId,
          actorName: adminSession.name,
          actorRole: 'SUPERADMIN',
          operation: `SUSCRIPCION_ESTADO_${newStatus}`,
          entityType: 'subscription',
          entityId: sub.id,
          details: `Cambio administrativo de estado comercial a ${newStatus}. Justificación: ${justification}. (Los documentos históricos nunca se eliminan por impago).`,
        });

        persistDb();
        return NextResponse.json({ subscription: sub });
      }

      // 3. Broadcast General Notification / Comunicado (Section 18)
      if (action === 'BROADCAST_NOTIFICATION') {
        const title = String(body.title || '').trim();
        const message = String(body.message || '').trim();
        if (!title || !message) {
          return NextResponse.json({ error: 'Título y mensaje son obligatorios.' }, { status: 422 });
        }

        const batchId = crypto.randomUUID().slice(0, 6);
        for (const c of db.companies) {
          db.notifications.unshift({
            id: `notif-${crypto.randomUUID().slice(0, 8)}`,
            companyId: c.id,
            dedupKey: `${c.id}:COMUNICADO:${batchId}`,
            type: 'COMUNICADO',
            severity: 'INFO',
            title,
            message,
            channel: 'PANEL_Y_CORREO',
            deliveryStatus: 'ENTREGADO',
            read: false,
            createdAtUtc: new Date().toISOString(),
          });
        }

        appendAuditLog({
          companyId: null,
          actorId: adminSession.userId,
          actorName: adminSession.name,
          actorRole: 'SUPERADMIN',
          operation: 'COMUNICADO_GENERAL_ENVIADO',
          entityType: 'notification',
          entityId: batchId,
          details: `Comunicado general enviado a ${db.companies.length} empresas: "${title}".`,
        });

        persistDb();
        return NextResponse.json({ sentCount: db.companies.length });
      }

      // 4. Update global BWP NEXO commercial configuration (Section 18)
      if (action === 'UPDATE_SYSTEM_CONFIG') {
        if (body.activationPriceHnl)
          db.systemConfig.activationPriceHnl = String(body.activationPriceHnl);
        if (body.monthlyPriceHnl)
          db.systemConfig.monthlyPriceHnl = String(body.monthlyPriceHnl);
        if (body.graceDays !== undefined)
          db.systemConfig.graceDays = Number(body.graceDays);
        if (typeof body.pricesIncludeTax === 'boolean')
          db.systemConfig.pricesIncludeTax = body.pricesIncludeTax;
        if (typeof body.bankInstructions === 'string')
          db.systemConfig.bankInstructions = body.bankInstructions.trim();
        if (typeof body.honorariosEnabled === 'boolean')
          db.systemConfig.honorariosEnabled = body.honorariosEnabled;

        appendAuditLog({
          companyId: null,
          actorId: adminSession.userId,
          actorName: adminSession.name,
          actorRole: 'SUPERADMIN',
          operation: 'CONFIGURACION_GLOBAL_BWP_ACTUALIZADA',
          entityType: 'system_config',
          entityId: 'global',
          details: `Actualización de parámetros BWP: Activación L ${db.systemConfig.activationPriceHnl}, Mensualidad L ${db.systemConfig.monthlyPriceHnl}, Días de gracia: ${db.systemConfig.graceDays}, Recibo Honorarios: ${db.systemConfig.honorariosEnabled ? 'Habilitado' : 'Deshabilitado'}.`,
        });

        persistDb();
        return NextResponse.json({ systemConfig: db.systemConfig });
      }

      // 5. Audited Support Ticket Resolution (Section 18: "Acceso administrativo de soporte justificado y auditado")
      if (action === 'RESOLVE_SUPPORT_TICKET') {
        const ticketId = String(body.ticketId || '');
        const justification = String(body.justification || '').trim();
        if (!justification) {
          return NextResponse.json(
            { error: 'Toda intervención de soporte administrativo exige justificación para auditoría.' },
            { status: 422 }
          );
        }
        const tkt = db.supportTickets.find((t) => t.id === ticketId);
        if (!tkt) {
          return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });
        }
        tkt.status = 'RESUELTO';
        tkt.adminJustification = justification;

        appendAuditLog({
          companyId: tkt.companyId,
          actorId: adminSession.userId,
          actorName: adminSession.name,
          actorRole: 'SUPERADMIN',
          operation: 'SOPORTE_ADMINISTRATIVO_AUDITADO',
          entityType: 'support_ticket',
          entityId: tkt.id,
          details: `Atención de ticket de soporte para ${tkt.companyName}. Justificación auditada: ${justification}`,
        });

        persistDb();
        return NextResponse.json({ ticket: tkt });
      }

      return NextResponse.json({ error: 'Acción administrativa no reconocida.' }, { status: 400 });
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al ejecutar operación administrativa.' },
      { status: e.status || 500 }
    );
  }
}

export const GET = databaseRoute(handleGET);
export const POST = databaseRoute(handlePOST);
