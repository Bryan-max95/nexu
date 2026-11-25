import { databaseRoute } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import {
  evaluateCaiQuantity,
  evaluateCaiVigencia,
  formatFiscalNumber,
  getHondurasDateString,
} from '@/lib/fiscal-engine';
import { getDb, runAutomaticNotificationsCheck } from '@/lib/server-store';

async function handleGET(req: NextRequest) {
  try {
    const { company } = requireCompanySession(req);
    const db = getDb();
    runAutomaticNotificationsCheck(company.id);

    const todayLocal = getHondurasDateString();
    const activeCai = db.fiscalAuthorizations.find(
      (c) =>
        c.companyId === company.id &&
        c.docType === 'FACTURA' &&
        (c.status === 'ACTIVO' || c.status === 'PROXIMO_A_VENCER')
    );

    const sub = db.subscriptions.find((s) => s.companyId === company.id);
    const companyDocs = db.documents.filter((d) => d.companyId === company.id);

    // Compute Dashboard metrics (Section 6: Distinguir ventas fiscales de recibos y cotizaciones)
    const currentMonthPrefix = todayLocal.slice(0, 7); // YYYY-MM

    let facturadoHoy = 0;
    let facturadoMes = 0;
    let facturasEmitidasCount = 0;
    let recibosEmitidosCount = 0;
    let cotizacionesCount = 0;
    let anuladosCount = 0;

    for (const d of companyDocs) {
      if (d.status === 'ANULADO') {
        anuladosCount++;
        continue;
      }
      if (d.status !== 'EMITIDO') continue;

      if (d.docType === 'FACTURA' || d.docType === 'NOTA_DEBITO') {
        if (d.docType === 'FACTURA') facturasEmitidasCount++;
        const amt = Number(d.totals.totalFiscal) || 0;
        if (d.issueDateLocal === todayLocal) facturadoHoy += amt;
        if (d.issueDateLocal.startsWith(currentMonthPrefix)) facturadoMes += amt;
      } else if (d.docType === 'NOTA_CREDITO') {
        const amt = Number(d.totals.totalFiscal) || 0;
        if (d.issueDateLocal === todayLocal) facturadoHoy -= amt;
        if (d.issueDateLocal.startsWith(currentMonthPrefix)) facturadoMes -= amt;
      } else if (d.docType === 'RECIBO') {
        recibosEmitidosCount++;
      } else if (d.docType === 'COTIZACION') {
        cotizacionesCount++;
      }
    }

    let caiSummary = null;
    if (activeCai) {
      const available = Math.max(0, activeCai.rangeEnd - activeCai.lastUsed);
      const nextCorrelative = Math.max(activeCai.rangeStart, activeCai.lastUsed + 1);
      const vigencia = evaluateCaiVigencia(activeCai.limitDate);
      const quantity = evaluateCaiQuantity(available);
      caiSummary = {
        id: activeCai.id,
        cai: activeCai.cai,
        limitDate: activeCai.limitDate,
        rangeStart: activeCai.rangeStart,
        rangeEnd: activeCai.rangeEnd,
        lastUsed: activeCai.lastUsed,
        available,
        nextFiscalNumber:
          nextCorrelative <= activeCai.rangeEnd
            ? formatFiscalNumber(
                activeCai.establishment,
                activeCai.emissionPoint,
                activeCai.docTypeCode,
                nextCorrelative
              )
            : 'AGOTADO',
        vigencia,
        quantity,
        canEmitFiscal: !vigencia.blocksEmission && !quantity.blocksEmission,
      };
    }

    const canEmitCommercial =
      Boolean(sub) &&
      sub!.activationPaid &&
      (sub!.status === 'ACTIVA' || sub!.status === 'PROXIMA_A_VENCER');

    return NextResponse.json({
      todayLocal,
      metrics: {
        facturadoHoy: facturadoHoy.toFixed(2),
        facturadoMes: facturadoMes.toFixed(2),
        facturasEmitidasCount: activeCai ? activeCai.lastUsed : facturasEmitidasCount,
        recibosEmitidosCount,
        cotizacionesCount,
        anuladosCount,
      },
      caiSummary,
      subscription: sub || null,
      canEmitCommercial,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al verificar estado fiscal.' },
      { status: e.status || 500 }
    );
  }
}

export const GET = databaseRoute(handleGET);
