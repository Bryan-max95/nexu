import { validateAttachment } from '@/lib/attachments';
import { databaseRoute } from '@/lib/database';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import {
  DocumentType,
  evaluateCaiQuantity,
  evaluateCaiVigencia,
  formatFiscalNumber,
  getHondurasDateString,
  validateCaiFormat,
} from '@/lib/fiscal-engine';
import {
  appendAuditLog,
  checkRolePermission,
  FiscalAuthorizationRecord,
  getDb,
  persistDb,
  withTransactionLock,
} from '@/lib/server-store';

async function handleGET(req: NextRequest) {
  try {
    const { company } = requireCompanySession(req);
    const db = getDb();
    const list = db.fiscalAuthorizations
      .filter((c) => c.companyId === company.id)
      .map((c) => {
        const available = Math.max(0, c.rangeEnd - c.lastUsed);
        const totalRange = c.rangeEnd - c.rangeStart + 1;
        const usedCount = Math.max(0, c.lastUsed - c.rangeStart + 1);
        const nextCorrelative = c.lastUsed < c.rangeStart ? c.rangeStart : c.lastUsed + 1;
        const vigenciaAlert = evaluateCaiVigencia(c.limitDate);
        const quantityAlert = evaluateCaiQuantity(available);
        const annulledCount = db.documents.filter(
          (d) => d.companyId === company.id && d.caiId === c.id && d.status === 'ANULADO'
        ).length;

        return {
          ...c,
          available,
          totalRange,
          usedCount: c.lastUsed === 0 ? 0 : usedCount,
          annulledCount,
          nextFiscalNumber:
            nextCorrelative <= c.rangeEnd
              ? formatFiscalNumber(c.establishment, c.emissionPoint, c.docTypeCode, nextCorrelative)
              : 'RANGO AGOTADO',
          rangeStartFormatted: formatFiscalNumber(c.establishment, c.emissionPoint, c.docTypeCode, c.rangeStart),
          rangeEndFormatted: formatFiscalNumber(c.establishment, c.emissionPoint, c.docTypeCode, c.rangeEnd),
          lastUsedFormatted:
            c.lastUsed > 0
              ? formatFiscalNumber(c.establishment, c.emissionPoint, c.docTypeCode, c.lastUsed)
              : 'Sin utilizar',
          vigenciaAlert,
          quantityAlert,
        };
      });

    return NextResponse.json({
      authorizations: list,
      internalSequences: db.internalSequences[company.id] || { RECIBO: 0, COTIZACION: 0 },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al listar autorizaciones CAI.' },
      { status: e.status || 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const { session, company, member } = requireCompanySession(req);
    if (!checkRolePermission(member.role, 'CONFIGURAR_CAI_EMPRESA')) {
      return NextResponse.json(
        { error: 'Permiso denegado (403): Solo el Propietario puede registrar nuevas autorizaciones CAI.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    return await withTransactionLock(async () => {
      const db = getDb();
      const docType = (body.docType as DocumentType) || 'FACTURA';
      const cai = String(body.cai || '').trim().toUpperCase();
      const establishment = String(body.establishment || company.establishmentCode || '000')
        .trim()
        .padStart(3, '0');
      const emissionPoint = String(body.emissionPoint || company.emissionPointCode || '001')
        .trim()
        .padStart(3, '0');
      const docTypeCode =
        docType === 'FACTURA'
          ? '01'
          : docType === 'NOTA_CREDITO'
            ? '06'
            : docType === 'NOTA_DEBITO'
              ? '07'
              : String(body.docTypeCode || '01').padStart(2, '0');

      const rangeStart = Number(body.rangeStart);
      const rangeEnd = Number(body.rangeEnd);
      const migratedLastUsed =
        body.lastUsed !== undefined && body.lastUsed !== '' ? Number(body.lastUsed) : 0;
      const authDate = String(body.authDate || getHondurasDateString()).trim();
      const limitDate = String(body.limitDate || '').trim();
      const supportPdfName = String(body.supportPdfName || 'Autorizacion_SAR_Autoimpresor.pdf').trim();
      const activateNow = Boolean(body.activateNow ?? true);

      if (!validateCaiFormat(cai)) {
        return NextResponse.json(
          {
            error:
              'Formato de CAI inválido. Debe seguir la estructura oficial de 32 caracteres separados por guiones: XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX.',
          },
          { status: 422 }
        );
      }

      if (!/^\d{3}$/.test(establishment) || !/^\d{3}$/.test(emissionPoint) || !/^\d{2}$/.test(docTypeCode)) {
        return NextResponse.json(
          { error: 'Prefijos inválidos: establecimiento (3 dígitos), punto de emisión (3 dígitos) y tipo (2 dígitos).' },
          { status: 422 }
        );
      }

      if (!Number.isInteger(rangeStart) || !Number.isInteger(rangeEnd) || rangeStart < 1 || rangeEnd < rangeStart) {
        return NextResponse.json(
          { error: 'El rango inicial y final deben ser enteros positivos con rango final >= rango inicial.' },
          { status: 422 }
        );
      }

      if (migratedLastUsed !== 0 && (migratedLastUsed < rangeStart - 1 || migratedLastUsed > rangeEnd)) {
        return NextResponse.json(
          {
            error: `El último correlativo utilizado por migración (${migratedLastUsed}) debe estar dentro del rango autorizado (${rangeStart} a ${rangeEnd}).`,
          },
          { status: 422 }
        );
      }

      if (!limitDate || limitDate < authDate) {
        return NextResponse.json(
          { error: 'La fecha límite de emisión debe ser igual o posterior a la fecha de autorización.' },
          { status: 422 }
        );
      }

      const todayHonduras = getHondurasDateString();
      if (activateNow && limitDate < todayHonduras) {
        return NextResponse.json(
          {
            error: `No se puede activar un CAI cuya fecha límite (${limitDate}) ya está vencida en zona horaria America/Tegucigalpa (${todayHonduras}).`,
          },
          { status: 422 }
        );
      }

      // Check duplicate CAI code
      if (db.fiscalAuthorizations.some((c) => c.cai === cai)) {
        return NextResponse.json(
          { error: `El CAI ${cai} ya se encuentra registrado en el sistema.` },
          { status: 409 }
        );
      }

      // Check overlapping ranges for same company, establishment, emission point, docTypeCode (Section 8.1)
      const sameSequenceCais = db.fiscalAuthorizations.filter(
        (c) =>
          c.companyId === company.id &&
          c.establishment === establishment &&
          c.emissionPoint === emissionPoint &&
          c.docTypeCode === docTypeCode &&
          c.status !== 'CANCELADO'
      );

      for (const prev of sameSequenceCais) {
        const overlaps = rangeStart <= prev.rangeEnd && rangeEnd >= prev.rangeStart;
        if (overlaps && prev.limitDate >= authDate) {
          return NextResponse.json(
            {
              error: `Conflicto de rango superpuesto (409): El rango ${rangeStart}-${rangeEnd} se superpone con la autorización anterior ${prev.cai} (${prev.rangeStart}-${prev.rangeEnd}).`,
            },
            { status: 409 }
          );
        }
        // Prevent sequence rollback (Section 8.1: "no retroceder secuencias")
        if (migratedLastUsed > 0 && migratedLastUsed < prev.lastUsed) {
          return NextResponse.json(
            {
              error: `No se permite retroceder secuencias fiscales: el último utilizado anterior fue ${prev.lastUsed}.`,
            },
            { status: 422 }
          );
        }
      }

      // If activating immediately, archive previous active CAI for same docType
      if (activateNow) {
        db.fiscalAuthorizations
          .filter(
            (c) =>
              c.companyId === company.id &&
              c.docType === docType &&
              (c.status === 'ACTIVO' || c.status === 'PROXIMO_A_VENCER')
          )
          .forEach((c) => {
            c.status = 'ARCHIVADO';
          });
      }

      const initialLastUsed = migratedLastUsed > 0 ? migratedLastUsed : rangeStart - 1;
      const newCai: FiscalAuthorizationRecord = {
        id: `cai-${crypto.randomUUID().slice(0, 8)}`,
        companyId: company.id,
        docType,
        cai,
        establishment,
        emissionPoint,
        docTypeCode,
        rangeStart,
        rangeEnd,
        lastUsed: initialLastUsed,
        migratedInitialLastUsed: migratedLastUsed > 0 ? migratedLastUsed : undefined,
        authDate,
        limitDate,
        supportPdfName,
        supportPdfDataUrl: validateAttachment(body.supportPdfDataUrl, true),
        status: activateNow ? 'ACTIVO' : 'PENDIENTE',
        createdAtUtc: new Date().toISOString(),
      };

      db.fiscalAuthorizations.unshift(newCai);

      appendAuditLog({
        companyId: company.id,
        actorId: session.userId,
        actorName: session.name,
        actorRole: member.role,
        operation: migratedLastUsed > 0 ? 'CAI_REGISTRADO_CON_MIGRACION' : 'CAI_REGISTRADO',
        entityType: 'fiscal_authorization',
        entityId: newCai.id,
        details: `Registro de CAI ${cai} (${docType}) rango ${formatFiscalNumber(establishment, emissionPoint, docTypeCode, rangeStart)} al ${formatFiscalNumber(establishment, emissionPoint, docTypeCode, rangeEnd)}. Último utilizado inicial: ${initialLastUsed}. Estado: ${newCai.status}.`,
      });

      persistDb();
      return NextResponse.json({ authorization: newCai });
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al registrar autorización CAI.' },
      { status: e.status || 500 }
    );
  }
}

export const GET = databaseRoute(handleGET);
export const POST = databaseRoute(handlePOST);
