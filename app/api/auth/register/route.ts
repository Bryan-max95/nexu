import { sendAccountMail } from '@/lib/mailer';
import { databaseRoute, consumeAuthAttempt } from '@/lib/database';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/api-auth';
import { getHondurasDateString } from '@/lib/fiscal-engine';
import {
  appendAuditLog,
  CompanyRecord,
  getDb,
  hashPassword,
  persistDb,
  signSessionToken,
  UserRecord,
  validateHondurasRtn,
} from '@/lib/server-store';

async function handlePOST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!enforceRateLimit(`register:${ip}`, 15, 60_000)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes de registro. Intente nuevamente en un minuto.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const responsibleName = String(body.responsibleName || '').trim();
    const commercialName = String(body.commercialName || '').trim();
    const legalName = String(body.legalName || commercialName).trim();
    const rtn = String(body.rtn || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if(!await consumeAuthAttempt(`register:${email}`,5,3600000)) return NextResponse.json({error:'Demasiados registros para este correo. Intente m?s tarde.'},{status:429});
    const whatsapp = String(body.whatsapp || '').trim();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || '');
    const acceptTerms = Boolean(body.acceptTerms);
    const department = String(body.department || 'Francisco Morazán').trim();
    const municipality = String(body.municipality || 'Distrito Central').trim();
    const addressMatriz = String(body.addressMatriz || 'Dirección Fiscal Principal').trim();

    if (!responsibleName || !commercialName || !rtn || !email || !whatsapp || !password) {
      return NextResponse.json(
        { error: 'Todos los campos obligatorios del formulario deben completarse.' },
        { status: 422 }
      );
    }

    if (!validateHondurasRtn(rtn)) {
      return NextResponse.json(
        { error: 'El RTN debe ser una cadena exacta de 14 dígitos numéricos (conservando ceros).' },
        { status: 422 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Formato de correo electrónico inválido.' },
        { status: 422 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres.' },
        { status: 422 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'La contraseña y su confirmación no coinciden.' },
        { status: 422 }
      );
    }

    if (!acceptTerms) {
      return NextResponse.json(
        { error: 'Debe aceptar los términos, condiciones y políticas de privacidad del servicio.' },
        { status: 422 }
      );
    }

    const db = getDb();

    if (db.companies.some((c) => c.rtn === rtn)) {
      return NextResponse.json(
        { error: `Ya existe una empresa registrada con el RTN ${rtn}.` },
        { status: 409 }
      );
    }

    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return NextResponse.json(
        { error: `El correo ${email} ya está registrado en BWP NEXO.` },
        { status: 409 }
      );
    }

    const { hash, salt } = hashPassword(password);
    const nowUtc = new Date().toISOString();
    const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const companyId = `comp-${crypto.randomUUID().slice(0, 8)}`;
    const verificationToken = crypto.randomBytes(20).toString('hex');

    const newUser: UserRecord = {
      id: userId,
      name: responsibleName,
      email,
      whatsapp,
      passwordHash: hash,
      passwordSalt: salt,
      emailVerified: false,
      verificationToken: crypto.createHash('sha256').update(verificationToken).digest('hex'),
      verificationExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      isSuperAdmin: false,
      mfaEnabled: false,
      termsAcceptedVersion: 'v1.0-SAR-2026',
      termsAcceptedAtUtc: nowUtc,
      createdAtUtc: nowUtc,
    };

    const newCompany: CompanyRecord = {
      id: companyId,
      legalName,
      commercialName,
      rtn,
      addressMatriz,
      addressEstablecimiento: `000 - ${addressMatriz}`,
      department,
      municipality,
      phone: whatsapp,
      whatsapp,
      email,
      website: '',
      economicActivity: 'Servicios profesionales y comerciales',
      representative: responsibleName,
      contributorType: 'PERSONA_JURIDICA',
      modality: 'Autoimpresor por sistema computarizado',
      establishmentCode: '000',
      emissionPointCode: '001',
      primaryColor: '#7A1C24',
      secondaryColor: '#1E293B',
      footerMessage: 'La factura es beneficio de todos. Exíjala. Original: Cliente · Copia: Obligado Tributario Emisor.',
      bankInfo: '',
      paymentTerms: 'Contado',
      paperSize: 'LETTER',
      defaultTemplate: 'CORPORATIVA',
      templateVersion: 'v1.0-SAR-2026',
      logoText: commercialName.slice(0, 12).toUpperCase(),
      createdAtUtc: nowUtc,
    };

    db.users.push(newUser);
    db.companies.push(newCompany);
    db.companyMembers.push({
      id: `mem-${crypto.randomUUID().slice(0, 8)}`,
      companyId,
      userId,
      userEmail: email,
      userName: responsibleName,
      role: 'PROPIETARIO',
      canExport: true,
      status: 'ACTIVO',
      invitedAtUtc: nowUtc,
    });

    const todayLocal = getHondurasDateString();
    db.subscriptions.push({
      id: `sub-${crypto.randomUUID().slice(0, 8)}`,
      companyId,
      planName: 'Plan Empresarial Autoimpresor BWP NEXO',
      activationFeeHnl: db.systemConfig.activationPriceHnl,
      monthlyFeeHnl: db.systemConfig.monthlyPriceHnl,
      activationPaid: false,
      status: 'PENDIENTE_ACTIVACION',
      currentPeriodStart: todayLocal,
      nextPaymentDate: todayLocal,
      graceDays: 3,
      updatedAtUtc: nowUtc,
    });

    db.internalSequences[companyId] = { RECIBO: 0, COTIZACION: 0 };

    appendAuditLog({
      companyId,
      actorId: userId,
      actorName: responsibleName,
      actorRole: 'PROPIETARIO',
      operation: 'REGISTRO_EMPRESA',
      entityType: 'company',
      entityId: companyId,
      details: `Registro de empresa ${commercialName} (RTN: ${rtn}). Aceptación términos v1.0-SAR-2026 (${nowUtc}). Estado: Pendiente de activación L 4,000.00.`,
    });

    persistDb();

    await sendAccountMail(email, verificationToken, 'verify');
    return NextResponse.json({ message: 'Cuenta creada. Revise su correo para verificarla antes de iniciar sesión.' }, { status: 201 });
  } catch (err: unknown) {
    const detail = err as { code?: string; command?: string; responseCode?: number };
    console.error('BWP registration failed', { code: detail.code, command: detail.command, responseCode: detail.responseCode });
    if (err instanceof Error && !detail.code) {
      let reason = err.message;
      for (const key of ['DATABASE_URL', 'ROOT_PASSWORD', 'GMAIL_PASSWORD', 'SESSION_SECRET']) {
        const secret = process.env[key]; if (secret) reason = reason.split(secret).join('[redacted]');
      }
      console.error('BWP registration failure reason:', reason);
    }
    const message = 'No se pudo completar el registro o enviar el correo. Intente nuevamente.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = databaseRoute(handlePOST);
