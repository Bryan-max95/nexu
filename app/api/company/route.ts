import { sendAccountMail } from '@/lib/mailer';
import { databaseRoute } from '@/lib/database';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import {
  appendAuditLog,
  checkRolePermission,
  CompanyRole,
  getDb,
  hashPassword,
  persistDb,
  runAutomaticNotificationsCheck,
  validateHondurasRtn,
} from '@/lib/server-store';

async function handleGET(req: NextRequest) {
  try {
    const { company, member } = requireCompanySession(req);
    const db = getDb();
    runAutomaticNotificationsCheck(company.id);

    const members = db.companyMembers.filter((m) => m.companyId === company.id);
    const notifications = db.notifications.filter((n) => n.companyId === company.id);
    const auditLogs = db.auditLogs.filter((a) => a.companyId === company.id).slice(0, 50);
    const integrationSetting =
      db.integrationSettings.find((i) => i.companyId === company.id) || {
        companyId: company.id,
        enabled: true,
        adapterType: 'EXPORTACION_CONCILIADA' as const,
        endpointUrl: '',
        accountSales15: '4101-01-01 Ventas Gravadas 15%',
        accountSales18: '4101-01-02 Ventas Gravadas 18%',
        accountSalesExempt: '4101-02-01 Ventas Exentas / Exoneradas',
        accountIsv15: '2104-01-01 ISV por Pagar 15%',
        accountIsv18: '2104-01-02 ISV por Pagar 18%',
        accountReceivable: '1103-01-01 Clientes Locales',
        updatedAtUtc: new Date().toISOString(),
      };
    const integrationEvents = db.integrationEvents.filter((e) => e.companyId === company.id);

    return NextResponse.json({
      company,
      currentMember: member,
      members,
      notifications,
      auditLogs,
      integrationSetting,
      integrationEvents,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al consultar datos de la empresa.' },
      { status: e.status || 500 }
    );
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const { session, company, member } = requireCompanySession(req);
    const body = await req.json();
    const action = String(body.action || 'UPDATE_COMPANY');
    const db = getDb();

    // Mark notification as read (allowed for all active roles)
    if (action === 'MARK_NOTIFICATIONS_READ') {
      db.notifications
        .filter((n) => n.companyId === company.id)
        .forEach((n) => {
          n.read = true;
        });
      persistDb();
      return NextResponse.json({ ok: true });
    }

    // Check server-side permission for company / CAI / user management (Section 19)
    if (action === 'INVITE_MEMBER' || action === 'REVOKE_MEMBER' || action === 'UPDATE_MEMBER_ROLE') {
      if (!checkRolePermission(member.role, 'GESTIONAR_USUARIOS_SUSCRIPCION')) {
        return NextResponse.json(
          { error: 'Permiso denegado (403): Solo el Propietario puede gestionar usuarios y permisos.' },
          { status: 403 }
        );
      }

      if (action === 'INVITE_MEMBER') {
        const email = String(body.email || '').trim().toLowerCase();
        const name = String(body.name || '').trim();
        const role = (body.role as CompanyRole) || 'FACTURADOR';
        if (!['PROPIETARIO','FACTURADOR','CONSULTA'].includes(role)) return NextResponse.json({error:'Rol inválido.'},{status:422});
        const canExport = Boolean(body.canExport ?? true);

        if (!email || !name) {
          return NextResponse.json({ error: 'Nombre y correo del miembro son obligatorios.' }, { status: 422 });
        }

        const existingMember = db.companyMembers.find(
          (m) => m.companyId === company.id && m.userEmail.toLowerCase() === email && m.status === 'ACTIVO'
        );
        if (existingMember) {
          return NextResponse.json({ error: 'Este correo ya es miembro activo de la empresa.' }, { status: 409 });
        }

        let targetUser = db.users.find((u) => u.email.toLowerCase() === email);
        if (!targetUser) {
          const tempPass = hashPassword(crypto.randomBytes(32).toString('hex'));
          const invitationToken = crypto.randomBytes(32).toString('hex');
          await sendAccountMail(email, invitationToken, 'reset');
          targetUser = {
            id: `usr-${crypto.randomUUID().slice(0, 8)}`,
            name,
            email,
            whatsapp: '',
            passwordHash: tempPass.hash,
            passwordSalt: tempPass.salt,
            emailVerified: false,
            resetToken: crypto.createHash('sha256').update(invitationToken).digest('hex'),
            resetExpiresAt: new Date(Date.now() + 3600000).toISOString(),
            isSuperAdmin: false,
            mfaEnabled: false,
            termsAcceptedVersion: 'v1.0-SAR-2026',
            termsAcceptedAtUtc: new Date().toISOString(),
            createdAtUtc: new Date().toISOString(),
          };
          db.users.push(targetUser);
        }

        const newMem = {
          id: `mem-${crypto.randomUUID().slice(0, 8)}`,
          companyId: company.id,
          userId: targetUser.id,
          userEmail: email,
          userName: name,
          role,
          canExport,
          status: 'ACTIVO' as const,
          invitedAtUtc: new Date().toISOString(),
        };
        db.companyMembers.push(newMem);

        appendAuditLog({
          companyId: company.id,
          actorId: session.userId,
          actorName: session.name,
          actorRole: member.role,
          operation: 'USUARIO_INVITADO',
          entityType: 'company_member',
          entityId: newMem.id,
          details: `Invitación de miembro ${name} (${email}) con rol ${role} (Exportar: ${canExport ? 'Sí' : 'No'}).`,
        });

        persistDb();
        return NextResponse.json({ member: newMem, members: db.companyMembers.filter((m) => m.companyId === company.id) });
      }

      if (action === 'REVOKE_MEMBER') {
        const memberId = String(body.memberId || '');
        const target = db.companyMembers.find((m) => m.id === memberId && m.companyId === company.id);
        if (!target) {
          return NextResponse.json({ error: 'Miembro no encontrado.' }, { status: 404 });
        }
        if (target.userId === session.userId) {
          return NextResponse.json({ error: 'No puede revocar su propio acceso de propietario.' }, { status: 422 });
        }
        target.status = 'REVOCADO';
        appendAuditLog({
          companyId: company.id,
          actorId: session.userId,
          actorName: session.name,
          actorRole: member.role,
          operation: 'ACCESO_REVOCADO',
          entityType: 'company_member',
          entityId: target.id,
          details: `Revocación de acceso para ${target.userName} (${target.userEmail}).`,
        });
        persistDb();
        return NextResponse.json({ members: db.companyMembers.filter((m) => m.companyId === company.id) });
      }

      if (action === 'UPDATE_MEMBER_ROLE') {
        const memberId = String(body.memberId || '');
        const target = db.companyMembers.find((m) => m.id === memberId && m.companyId === company.id);
        if (!target) {
          return NextResponse.json({ error: 'Miembro no encontrado.' }, { status: 404 });
        }
        if (body.role) target.role = body.role as CompanyRole;
        if (typeof body.canExport === 'boolean') target.canExport = body.canExport;
        appendAuditLog({
          companyId: company.id,
          actorId: session.userId,
          actorName: session.name,
          actorRole: member.role,
          operation: 'PERMISO_ACTUALIZADO',
          entityType: 'company_member',
          entityId: target.id,
          details: `Actualización de rol/permiso para ${target.userName}: Rol ${target.role}, Exportar: ${target.canExport}.`,
        });
        persistDb();
        return NextResponse.json({ members: db.companyMembers.filter((m) => m.companyId === company.id) });
      }
    }

    // Update company fiscal or template configuration
    if (!checkRolePermission(member.role, 'CONFIGURAR_CAI_EMPRESA')) {
      return NextResponse.json(
        { error: 'Permiso denegado (403): Solo el Propietario puede modificar la configuración fiscal o plantillas.' },
        { status: 403 }
      );
    }

    if (action === 'UPDATE_INTEGRATION') {
      let setting = db.integrationSettings.find((i) => i.companyId === company.id);
      if (!setting) {
        setting = {
          companyId: company.id,
          enabled: true,
          adapterType: 'EXPORTACION_CONCILIADA',
          endpointUrl: '',
          accountSales15: '4101-01-01 Ventas Gravadas 15%',
          accountSales18: '4101-01-02 Ventas Gravadas 18%',
          accountSalesExempt: '4101-02-01 Ventas Exentas / Exoneradas',
          accountIsv15: '2104-01-01 ISV por Pagar 15%',
          accountIsv18: '2104-01-02 ISV por Pagar 18%',
          accountReceivable: '1103-01-01 Clientes Locales',
          updatedAtUtc: new Date().toISOString(),
        };
        db.integrationSettings.push(setting);
      }
      if (typeof body.enabled === 'boolean') setting.enabled = body.enabled;
      if (body.adapterType) setting.adapterType = body.adapterType;
      if (typeof body.endpointUrl === 'string') setting.endpointUrl = body.endpointUrl.trim();
      if (typeof body.accountSales15 === 'string') setting.accountSales15 = body.accountSales15.trim();
      if (typeof body.accountSales18 === 'string') setting.accountSales18 = body.accountSales18.trim();
      if (typeof body.accountIsv15 === 'string') setting.accountIsv15 = body.accountIsv15.trim();
      setting.updatedAtUtc = new Date().toISOString();

      appendAuditLog({
        companyId: company.id,
        actorId: session.userId,
        actorName: session.name,
        actorRole: member.role,
        operation: 'INTEGRACION_CONTABLE_ACTUALIZADA',
        entityType: 'integration_settings',
        entityId: company.id,
        details: `Configuración de adaptador contable externo (${setting.adapterType}).`,
      });
      persistDb();
      return NextResponse.json({ integrationSetting: setting });
    }

    if (body.rtn && !validateHondurasRtn(String(body.rtn))) {
      return NextResponse.json(
        { error: 'El RTN debe contener exactamente 14 dígitos numéricos conservando ceros.' },
        { status: 422 }
      );
    }

    // Validate logo size & MIME if uploaded (Section 7 & 26)
    if (typeof body.logoDataUrl === 'string' && body.logoDataUrl.length > 0) {
      if (
        !body.logoDataUrl.startsWith('data:image/png;base64,') &&
        !body.logoDataUrl.startsWith('data:image/jpeg;base64,') &&
        !body.logoDataUrl.startsWith('data:image/webp;base64,')
      ) {
        return NextResponse.json(
          { error: 'El logotipo debe ser una imagen PNG o JPG válida.' },
          { status: 422 }
        );
      }
      if (body.logoDataUrl.length > 800_000) {
        return NextResponse.json(
          { error: 'El archivo del logotipo supera el límite de tamaño permitido (máx. 500 KB).' },
          { status: 422 }
        );
      }
      company.logoDataUrl = body.logoDataUrl;
    }

    const fieldsToUpdate: Array<keyof typeof company> = [
      'legalName',
      'commercialName',
      'rtn',
      'addressMatriz',
      'addressEstablecimiento',
      'department',
      'municipality',
      'phone',
      'whatsapp',
      'email',
      'website',
      'economicActivity',
      'representative',
      'contributorType',
      'establishmentCode',
      'emissionPointCode',
      'primaryColor',
      'secondaryColor',
      'footerMessage',
      'bankInfo',
      'paymentTerms',
      'paperSize',
      'defaultTemplate',
      'logoText',
    ];

    for (const key of fieldsToUpdate) {
      if (body[key] !== undefined) {
        (company as unknown as Record<string, unknown>)[key] = String(body[key]).trim();
      }
    }

    appendAuditLog({
      companyId: company.id,
      actorId: session.userId,
      actorName: session.name,
      actorRole: member.role,
      operation: 'EMPRESA_ACTUALIZADA',
      entityType: 'company',
      entityId: company.id,
      details: `Actualización de datos fiscales/plantilla (${company.defaultTemplate}, ${company.paperSize}). Los documentos históricos emitidos conservan su snapshot original intacto.`,
    });

    persistDb();
    return NextResponse.json({ company });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al actualizar datos de la empresa.' },
      { status: e.status || 500 }
    );
  }
}

export const GET = databaseRoute(handleGET);
export const PATCH = databaseRoute(handlePATCH);
