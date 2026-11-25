import { databaseRoute } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import { evaluateCaiVigencia, getHondurasDateString } from '@/lib/fiscal-engine';
import {
  appendAuditLog,
  CaiStatus,
  checkRolePermission,
  getDb,
  persistDb,
  withTransactionLock,
} from '@/lib/server-store';

async function handlePOST(req: NextRequest) {
  try {
    const { session, company, member } = requireCompanySession(req);
    if (!checkRolePermission(member.role, 'CONFIGURAR_CAI_EMPRESA')) {
      return NextResponse.json(
        { error: 'Permiso denegado (403): Solo el Propietario puede activar o cambiar estado de un CAI.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const caiId = String(body.caiId || '').trim();
    const targetStatus = (body.status as CaiStatus) || 'ACTIVO';

    return await withTransactionLock(async () => {
      const db = getDb();
      const targetCai = db.fiscalAuthorizations.find(
        (c) => c.id === caiId && c.companyId === company.id
      );

      if (!targetCai) {
        return NextResponse.json({ error: 'Autorización CAI no encontrada.' }, { status: 404 });
      }

      if (targetStatus === 'ACTIVO') {
        const vig = evaluateCaiVigencia(targetCai.limitDate);
        if (vig.blocksEmission || getHondurasDateString() > targetCai.limitDate) {
          return NextResponse.json(
            { error: `No se puede activar el CAI ${targetCai.cai}: fecha límite vencida (${targetCai.limitDate}).` },
            { status: 422 }
          );
        }
        if (targetCai.lastUsed >= targetCai.rangeEnd) {
          return NextResponse.json(
            { error: `No se puede activar el CAI ${targetCai.cai}: el rango autorizado está agotado.` },
            { status: 422 }
          );
        }

        // Archive other active CAIs for the same document type
        db.fiscalAuthorizations
          .filter(
            (c) =>
              c.companyId === company.id &&
              c.docType === targetCai.docType &&
              c.id !== targetCai.id &&
              (c.status === 'ACTIVO' || c.status === 'PROXIMO_A_VENCER')
          )
          .forEach((c) => {
            c.status = 'ARCHIVADO';
          });
      }

      targetCai.status = targetStatus;

      appendAuditLog({
        companyId: company.id,
        actorId: session.userId,
        actorName: session.name,
        actorRole: member.role,
        operation: `CAI_ESTADO_${targetStatus}`,
        entityType: 'fiscal_authorization',
        entityId: targetCai.id,
        details: `Cambio de estado de CAI ${targetCai.cai} (${targetCai.docType}) a ${targetStatus}.`,
      });

      persistDb();
      return NextResponse.json({ authorization: targetCai });
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al actualizar estado del CAI.' },
      { status: e.status || 500 }
    );
  }
}

export const POST = databaseRoute(handlePOST);
