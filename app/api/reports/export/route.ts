import { databaseRoute } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import { formatFiscalNumber } from '@/lib/fiscal-engine';
import { appendAuditLog, checkRolePermission, getDb } from '@/lib/server-store';

async function handleGET(req: NextRequest) {
  try {
    const { session, company, member } = requireCompanySession(req);
    if (!checkRolePermission(member.role, 'EXPORTAR', member.canExport)) {
      return NextResponse.json(
        { error: 'Permiso denegado (403): Su usuario no cuenta con permiso de exportación.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('reportType') || 'FACTURACION';
    const format = searchParams.get('format') || 'CSV'; // CSV (Excel compatible) or TXT
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const db = getDb();
    let docs = db.documents.filter((d) => d.companyId === company.id);
    if (dateFrom) docs = docs.filter((d) => d.issueDateLocal >= dateFrom);
    if (dateTo) docs = docs.filter((d) => d.issueDateLocal <= dateTo);

    let csvRows: string[][] = [];
    let filename = `REPORTE_${reportType}_${company.rtn}.csv`;

    if (reportType === 'FACTURACION') {
      // Section 16: Separar recibos/cotizaciones de facturación fiscal y ajustes, evitar duplicar ingresos
      csvRows.push([
        'CLASIFICACION',
        'TIPO_DOCUMENTO',
        'NUMERO_FISCAL',
        'CAI',
        'FECHA_LOCAL_HN',
        'ESTADO',
        'RTN_CLIENTE',
        'CLIENTE',
        'BASE_EXENTA',
        'BASE_EXONERADA',
        'BASE_GRAVADA_15',
        'BASE_GRAVADA_18',
        'ISV_15',
        'ISV_18',
        'TOTAL_FISCAL_NETO',
      ]);
      for (const d of docs) {
        if (d.status === 'BORRADOR') continue;
        const isFiscal =
          d.docType === 'FACTURA' || d.docType === 'NOTA_CREDITO' || d.docType === 'NOTA_DEBITO';
        const sign = d.docType === 'NOTA_CREDITO' ? '-' : '';
        const activeVal = (v: string) => (d.status === 'ANULADO' ? '0.00' : `${sign}${v}`);
        csvRows.push([
          isFiscal ? 'VENTA_FISCAL_SAR' : 'CONSTANCIA_NO_FISCAL_EXCLUIDA_DE_INGRESO_FISCAL',
          d.docType,
          d.fiscalNumber,
          d.caiCode || 'N/A',
          d.issueDateLocal,
          d.status,
          d.clientRtn || 'CONSUMIDOR_FINAL',
          d.clientName,
          activeVal(d.totals.baseExenta),
          activeVal(d.totals.baseExonerada),
          activeVal(d.totals.baseGravada15),
          activeVal(d.totals.baseGravada18),
          activeVal(d.totals.isv15),
          activeVal(d.totals.isv18),
          activeVal(d.totals.totalFiscal),
        ]);
      }
    } else if (reportType === 'ANULADOS') {
      csvRows.push([
        'TIPO_DOCUMENTO',
        'NUMERO_FISCAL_BLOQUEADO',
        'CAI',
        'FECHA_EMISION',
        'FECHA_ANULACION_UTC',
        'RESPONSABLE_ANULACION',
        'MOTIVO_LEGAL',
        'IMPORTE_ORIGINAL',
      ]);
      for (const d of docs.filter((x) => x.status === 'ANULADO')) {
        csvRows.push([
          d.docType,
          d.fiscalNumber,
          d.caiCode || 'N/A',
          d.issueDateLocal,
          d.cancellation?.cancelledAtUtc || '',
          d.cancellation?.userName || '',
          d.cancellation?.reason || '',
          d.totals.totalFiscal,
        ]);
      }
    } else if (reportType === 'CORRELATIVOS') {
      csvRows.push([
        'CAI',
        'TIPO_DOCUMENTAL',
        'RANGO_INICIAL',
        'RANGO_FINAL',
        'ULTIMO_UTILIZADO',
        'TOTAL_USADOS',
        'ANULADOS_EN_RANGO',
        'NO_UTILIZADOS_DISPONIBLES',
        'FECHA_LIMITE',
        'ESTADO_CAI',
      ]);
      for (const c of db.fiscalAuthorizations.filter((x) => x.companyId === company.id)) {
        const used = c.lastUsed >= c.rangeStart ? c.lastUsed - c.rangeStart + 1 : 0;
        const available = Math.max(0, c.rangeEnd - c.lastUsed);
        const annulled = db.documents.filter(
          (d) => d.companyId === company.id && d.caiId === c.id && d.status === 'ANULADO'
        ).length;
        csvRows.push([
          c.cai,
          c.docType,
          formatFiscalNumber(c.establishment, c.emissionPoint, c.docTypeCode, c.rangeStart),
          formatFiscalNumber(c.establishment, c.emissionPoint, c.docTypeCode, c.rangeEnd),
          c.lastUsed > 0
            ? formatFiscalNumber(c.establishment, c.emissionPoint, c.docTypeCode, c.lastUsed)
            : 'SIN_USO',
          String(used),
          String(annulled),
          String(available),
          c.limitDate,
          c.status,
        ]);
      }
    } else if (reportType === 'RESUMEN_ISV') {
      csvRows.push([
        'TRATAMIENTO_TRIBUTARIO',
        'CANTIDAD_DOCUMENTOS_FISCALES',
        'BASE_ACUMULADA_HNL',
        'ISV_ACUMULADO_HNL',
      ]);
      let exenta = 0;
      let exonerada = 0;
      let tasaCero = 0;
      let grav15 = 0;
      let grav18 = 0;
      let isv15 = 0;
      let isv18 = 0;
      let count = 0;

      for (const d of docs) {
        if (
          d.status !== 'EMITIDO' ||
          (d.docType !== 'FACTURA' && d.docType !== 'NOTA_CREDITO' && d.docType !== 'NOTA_DEBITO')
        ) {
          continue;
        }
        count++;
        const mult = d.docType === 'NOTA_CREDITO' ? -1 : 1;
        exenta += mult * Number(d.totals.baseExenta);
        exonerada += mult * Number(d.totals.baseExonerada);
        tasaCero += mult * Number(d.totals.baseAlicuotaCero);
        grav15 += mult * Number(d.totals.baseGravada15);
        grav18 += mult * Number(d.totals.baseGravada18);
        isv15 += mult * Number(d.totals.isv15);
        isv18 += mult * Number(d.totals.isv18);
      }

      csvRows.push(['Operaciones Exentas', String(count), exenta.toFixed(2), '0.00']);
      csvRows.push(['Operaciones Exoneradas', String(count), exonerada.toFixed(2), '0.00']);
      csvRows.push(['Operaciones Alícuota Cero (0%)', String(count), tasaCero.toFixed(2), '0.00']);
      csvRows.push(['Operaciones Gravadas 15%', String(count), grav15.toFixed(2), isv15.toFixed(2)]);
      csvRows.push(['Operaciones Gravadas 18%', String(count), grav18.toFixed(2), isv18.toFixed(2)]);
      csvRows.push([
        'TOTAL CONSOLIDADO FISCAL',
        String(count),
        (exenta + exonerada + tasaCero + grav15 + grav18).toFixed(2),
        (isv15 + isv18).toFixed(2),
      ]);
    } else if (reportType === 'HISTORIAL_CAI') {
      csvRows.push([
        'ID_AUTORIZACION',
        'CAI',
        'TIPO',
        'ESTABLECIMIENTO',
        'PUNTO_EMISION',
        'FECHA_AUTORIZACION',
        'FECHA_LIMITE',
        'ARCHIVO_RESPALDO_SAR',
        'ESTADO',
      ]);
      for (const c of db.fiscalAuthorizations.filter((x) => x.companyId === company.id)) {
        csvRows.push([
          c.id,
          c.cai,
          c.docType,
          c.establishment,
          c.emissionPoint,
          c.authDate,
          c.limitDate,
          c.supportPdfName,
          c.status,
        ]);
      }
    } else {
      // INTEGRACION_CONTABLE
      filename = `INTEGRACION_CONTABLE_${company.rtn}.${format === 'TXT' ? 'txt' : 'csv'}`;
      csvRows.push([
        'ID_EVENTO',
        'REFERENCIA_ASIENTO_EXTERNO',
        'TIPO_EVENTO',
        'NUMERO_FISCAL',
        'RESUMEN_CONTABLE',
        'INTENTOS',
        'ESTADO_CONCILIACION',
        'FECHA_UTC',
      ]);
      for (const ev of db.integrationEvents.filter((x) => x.companyId === company.id)) {
        csvRows.push([
          ev.id,
          ev.externalReference,
          ev.eventType,
          ev.fiscalNumber,
          ev.payloadSummary,
          String(ev.attempts),
          ev.status,
          ev.updatedAtUtc,
        ]);
      }
    }

    appendAuditLog({
      companyId: company.id,
      actorId: session.userId,
      actorName: session.name,
      actorRole: member.role,
      operation: `REPORTE_EXPORTADO_${reportType}`,
      entityType: 'report',
      entityId: reportType,
      details: `Exportación de reporte ${reportType} en formato ${format} (${csvRows.length - 1} filas).`,
    });

    const sep = format === 'TXT' ? '\t' : ',';
    const content =
      '\uFEFF' +
      csvRows
        .map((row) =>
          row
            .map((cell) => {
              const str = String(cell ?? '').replace(/"/g, '""');
              return format === 'TXT' ? str : `"${str}"`;
            })
            .join(sep)
        )
        .join('\r\n');

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': format === 'TXT' ? 'text/plain; charset=utf-8' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al exportar reporte.' },
      { status: e.status || 500 }
    );
  }
}

export const GET = databaseRoute(handleGET);
