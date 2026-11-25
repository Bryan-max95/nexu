'use client';

import React from 'react';
import { formatCurrency, formatHondurasDateDisplay } from '@/lib/fiscal-engine';
import { PaperSize, PdfDocumentPayload, TemplateId } from '@/lib/pdf-generator';

interface InvoiceTemplatePreviewProps {
  payload: PdfDocumentPayload;
  templateOverride?: TemplateId;
  paperSizeOverride?: PaperSize;
  primaryColorOverride?: string;
  compact?: boolean;
}

export default function InvoiceTemplatePreview({
  payload,
  templateOverride,
  paperSizeOverride,
  primaryColorOverride,
  compact = false,
}: InvoiceTemplatePreviewProps) {
  const template = templateOverride || payload.templateUsed || 'CORPORATIVA';
  const paper = paperSizeOverride || payload.paperSize || 'LETTER';
  const primaryColor = primaryColorOverride || payload.companySnapshot.primaryColor || '#7A1C24';
  const currency = payload.currency || 'HNL';

  return (
    <div
      className={`relative bg-white text-[#141414] border border-neutral-200 transition-all overflow-hidden ${
        compact ? 'p-5 text-xs' : 'p-7 sm:p-9 text-xs sm:text-sm'
      } ${paper === 'A4' ? 'max-w-[760px]' : 'max-w-[780px]'} mx-auto`}
    >
      {/* Watermark for BORRADOR or ANULADO */}
      {(payload.status === 'BORRADOR' || payload.status === 'ANULADO') && (
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-10"
        >
          <span
            className={`font-display font-bold tracking-widest uppercase -rotate-12 px-6 py-2 border-2 ${
              payload.status === 'ANULADO'
                ? 'text-red-700/25 border-red-700/25 text-2xl sm:text-4xl'
                : 'text-neutral-900/15 border-neutral-900/15 text-xl sm:text-3xl'
            }`}
          >
            {payload.status === 'ANULADO' ? 'DOCUMENTO ANULADO' : 'BORRADOR · SIN VALIDEZ FISCAL'}
          </span>
        </div>
      )}

      {/* Template Header Variants (Section 10 & 11) */}
      {template === 'CORPORATIVA' && (
        <div
          style={{ backgroundColor: primaryColor }}
          className="text-white p-5 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="font-display font-bold text-lg tracking-tight">
              {payload.companySnapshot.commercialName || payload.companySnapshot.legalName}
            </div>
            <div className="text-white/90 text-xs">
              {payload.companySnapshot.legalName} · RTN:{' '}
              <span className="font-mono tabular-nums font-semibold">{payload.companySnapshot.rtn}</span>
            </div>
            <div className="text-white/80 text-xs">
              Casa Matriz: {payload.companySnapshot.addressMatriz} · {payload.companySnapshot.municipality},{' '}
              {payload.companySnapshot.department}
            </div>
            <div className="text-white/80 text-xs">
              Establecimiento: {payload.companySnapshot.addressEstablecimiento} · Tel:{' '}
              {payload.companySnapshot.phone} · {payload.companySnapshot.email}
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <div className="font-display font-bold text-base uppercase tracking-wide">
              {payload.docTypeLabel}
            </div>
            <div className="font-mono tabular-nums text-sm font-semibold mt-1 bg-black/20 px-2.5 py-1 inline-block">
              No. {payload.fiscalNumber}
            </div>
            <div className="text-[11px] text-white/85 mt-1">
              Fecha: {formatHondurasDateDisplay(payload.issueDateLocal)}
            </div>
          </div>
        </div>
      )}

      {template === 'CLASICA' && (
        <div className="border-2 border-neutral-900 p-4 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="font-display font-bold text-base sm:text-lg text-neutral-950 uppercase">
              {payload.companySnapshot.legalName}
            </div>
            <div className="text-xs text-neutral-800">
              Nombre Comercial: {payload.companySnapshot.commercialName} · RTN:{' '}
              <span className="font-mono tabular-nums font-bold">{payload.companySnapshot.rtn}</span>
            </div>
            <div className="text-xs text-neutral-700">
              Casa Matriz: {payload.companySnapshot.addressMatriz} ({payload.companySnapshot.municipality},{' '}
              {payload.companySnapshot.department})
            </div>
            <div className="text-xs text-neutral-700">
              Establecimiento: {payload.companySnapshot.addressEstablecimiento} · Tel:{' '}
              {payload.companySnapshot.phone} · Correo: {payload.companySnapshot.email}
            </div>
          </div>
          <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-neutral-900 pt-2 sm:pt-0 sm:pl-4 shrink-0">
            <div className="font-display font-bold text-sm uppercase text-neutral-950">
              {payload.docTypeLabel}
            </div>
            <div className="font-mono tabular-nums text-sm font-bold text-neutral-950 mt-1">
              {payload.fiscalNumber}
            </div>
            <div className="text-xs text-neutral-700 mt-1">
              Emisión: {formatHondurasDateDisplay(payload.issueDateLocal)}
            </div>
          </div>
        </div>
      )}

      {template === 'MINIMALISTA' && (
        <div className="pb-4 mb-5 border-b border-neutral-300 flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-display font-semibold text-lg text-neutral-900">
              {payload.companySnapshot.commercialName || payload.companySnapshot.legalName}
            </div>
            <div className="text-xs text-neutral-600">
              {payload.companySnapshot.legalName} · RTN{' '}
              <span className="font-mono tabular-nums">{payload.companySnapshot.rtn}</span>
            </div>
            <div className="text-xs text-neutral-500">
              {payload.companySnapshot.addressMatriz} · Est. {payload.companySnapshot.addressEstablecimiento} ·{' '}
              {payload.companySnapshot.phone}
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
              {payload.docTypeLabel}
            </div>
            <div className="font-mono tabular-nums text-sm font-semibold text-neutral-900 mt-0.5">
              {payload.fiscalNumber}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {formatHondurasDateDisplay(payload.issueDateLocal)}
            </div>
          </div>
        </div>
      )}

      {/* Fiscal CAI Block or Non-Fiscal Legend */}
      <div className="mb-4 pb-3 border-b border-neutral-200 text-xs">
        {payload.caiSnapshot ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-neutral-700">
            <div>
              <span className="font-semibold text-neutral-900">CAI: </span>
              <span className="font-mono tabular-nums">{payload.caiSnapshot.cai}</span>
            </div>
            <div className="sm:text-right">
              <span className="font-semibold text-neutral-900">Fecha Límite de Emisión: </span>
              <span className="font-mono tabular-nums">
                {formatHondurasDateDisplay(payload.caiSnapshot.limitDate)}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="font-semibold text-neutral-900">Rango Autorizado: </span>
              <span className="font-mono tabular-nums">
                {payload.caiSnapshot.rangeStartFormatted} al {payload.caiSnapshot.rangeEndFormatted}
              </span>
              <span className="mx-2 text-neutral-400">·</span>
              <span>Modalidad: {payload.companySnapshot.modality}</span>
            </div>
          </div>
        ) : (
          <div className="text-neutral-700 font-medium">
            DOCUMENTO COMERCIAL / CONSTANCIA NO FISCAL · NO SUSTITUYE FACTURA FISCAL · Secuencia interna
            independiente
          </div>
        )}
      </div>

      {/* Adquirente / Client Information (Section 11) */}
      <div className="bg-neutral-50 border border-neutral-200 p-3.5 mb-4 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <span className="text-neutral-500">Adquirente / Cliente: </span>
          <span className="font-semibold text-neutral-900">{payload.clientSnapshot.name}</span>
        </div>
        <div className="sm:text-right">
          <span className="text-neutral-500">RTN / Identificación: </span>
          <span className="font-mono tabular-nums font-semibold text-neutral-900">
            {payload.clientSnapshot.rtn ||
              payload.clientSnapshot.idDoc ||
              (payload.clientSnapshot.isFinalConsumer ? 'CONSUMIDOR FINAL' : 'N/A')}
          </span>
        </div>
        <div>
          <span className="text-neutral-500">Dirección: </span>
          <span className="text-neutral-800">{payload.clientSnapshot.address || 'Ciudad'}</span>
        </div>
        <div className="sm:text-right">
          <span className="text-neutral-500">Forma de Pago: </span>
          <span className="text-neutral-800">
            {payload.paymentMethod} ({payload.paymentCondition})
          </span>
        </div>
        <div className="sm:col-span-2 pt-1.5 border-t border-neutral-200/80 text-[11px] text-neutral-600 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            O.C. Exenta:{' '}
            <strong className="font-mono text-neutral-800">
              {payload.clientSnapshot.exoneratedOrder || '____________'}
            </strong>
          </span>
          <span>
            Constancia Reg. Exonerado:{' '}
            <strong className="font-mono text-neutral-800">
              {payload.clientSnapshot.exoneratedRegistry || '____________'}
            </strong>
          </span>
          <span>
            Reg. SAG:{' '}
            <strong className="font-mono text-neutral-800">
              {payload.clientSnapshot.exoneratedSag || '____________'}
            </strong>
          </span>
        </div>
      </div>

      {/* Linked Original Invoice if Credit / Debit Note */}
      {payload.relatedDocSnapshot && (
        <div className="mb-4 p-2.5 bg-amber-50/70 border border-amber-200 text-xs text-amber-950">
          <span className="font-semibold">Documento Fiscal Vinculado: </span>
          <span className="font-mono tabular-nums">{payload.relatedDocSnapshot.fiscalNumber}</span>
          <span className="mx-1.5">·</span>
          <span>CAI: {payload.relatedDocSnapshot.cai}</span>
          <span className="mx-1.5">·</span>
          <span>Motivo: {payload.relatedDocSnapshot.reason}</span>
        </div>
      )}

      {/* Cancellation Notice if ANULADO */}
      {payload.status === 'ANULADO' && payload.cancellationSnapshot && (
        <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-xs text-red-900">
          <span className="font-semibold">ANULACIÓN REGISTRADA: </span>
          <span>Motivo: {payload.cancellationSnapshot.reason}</span>
          <span className="mx-1.5">·</span>
          <span>Responsable: {payload.cancellationSnapshot.cancelledBy}</span>
        </div>
      )}

      {/* Items Table */}
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr
              style={
                template === 'CORPORATIVA'
                  ? { backgroundColor: primaryColor, color: '#FFFFFF' }
                  : undefined
              }
              className={
                template === 'CLASICA'
                  ? 'border-y-2 border-neutral-900 bg-neutral-100 text-neutral-950'
                  : template === 'MINIMALISTA'
                    ? 'border-b border-neutral-300 text-neutral-600'
                    : ''
              }
            >
              <th className="py-2 px-2.5 font-semibold w-16">CANT.</th>
              <th className="py-2 px-2.5 font-semibold">CONCEPTO / DESCRIPCIÓN</th>
              <th className="py-2 px-2.5 font-semibold text-right w-24">P. UNIT.</th>
              <th className="py-2 px-2.5 font-semibold text-right w-20">DESC.</th>
              <th className="py-2 px-2.5 font-semibold text-right w-20">TRAT.</th>
              <th className="py-2 px-2.5 font-semibold text-right w-28">IMPORTE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {payload.items.map((item, idx) => (
              <tr key={idx} className="text-neutral-800">
                <td className="py-2 px-2.5 font-mono tabular-nums">{item.quantity}</td>
                <td className="py-2 px-2.5">{item.description || 'Concepto sin descripción'}</td>
                <td className="py-2 px-2.5 font-mono tabular-nums text-right">
                  {formatCurrency(item.unitPrice, currency)}
                </td>
                <td className="py-2 px-2.5 font-mono tabular-nums text-right">
                  {formatCurrency(item.discount, currency)}
                </td>
                <td className="py-2 px-2.5 text-right text-[11px] text-neutral-600">
                  {item.taxTreatment === 'ISV_15'
                    ? 'Grav. 15%'
                    : item.taxTreatment === 'ISV_18'
                      ? 'Grav. 18%'
                      : item.taxTreatment === 'EXENTO'
                        ? 'Exento'
                        : item.taxTreatment === 'EXONERADO'
                          ? 'Exonerado'
                          : 'Tasa 0%'}
                </td>
                <td className="py-2 px-2.5 font-mono tabular-nums font-medium text-right">
                  {formatCurrency(item.baseAmount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & Words Breakdown (Section 9.2 & 11) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 pt-3 border-t border-neutral-300 text-xs">
        <div className="sm:col-span-7 space-y-2">
          <div>
            <span className="font-semibold text-neutral-900">SON: </span>
            <span className="font-mono text-neutral-800">{payload.totals.totalInWords}</span>
          </div>
          {payload.companySnapshot.bankInfo && (
            <div className="text-[11px] text-neutral-600">
              <span className="font-semibold text-neutral-800">Información Bancaria: </span>
              {payload.companySnapshot.bankInfo}
            </div>
          )}
          <div className="text-[11px] text-neutral-500 pt-2">
            <div>Original: Cliente · Copia: Obligado Tributario Emisor</div>
            <div>{payload.companySnapshot.footerMessage}</div>
          </div>
        </div>

        <div className="sm:col-span-5 space-y-1 text-xs">
          <div className="flex justify-between text-neutral-600">
            <span>Descuentos / Rebajas:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(payload.totals.totalDiscounts, currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Importe Exento:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(payload.totals.baseExenta, currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Importe Exonerado:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(payload.totals.baseExonerada, currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Importe Alícuota Cero:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(payload.totals.baseAlicuotaCero, currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-700">
            <span>Importe Gravado 15%:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(payload.totals.baseGravada15, currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-700">
            <span>Importe Gravado 18%:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(payload.totals.baseGravada18, currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-800 font-medium">
            <span>ISV 15%:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(payload.totals.isv15, currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-800 font-medium">
            <span>ISV 18%:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(payload.totals.isv18, currency)}
            </span>
          </div>
          <div
            style={template === 'CORPORATIVA' ? { color: primaryColor } : undefined}
            className="flex justify-between pt-2 border-t border-neutral-300 font-display font-bold text-sm text-neutral-950"
          >
            <span>TOTAL:</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(payload.totals.totalFiscal, currency)}
            </span>
          </div>
          {Number(payload.totals.retencionAmount) > 0 && (
            <>
              <div className="flex justify-between text-neutral-600">
                <span>Retención separada:</span>
                <span className="font-mono tabular-nums">
                  -{formatCurrency(payload.totals.retencionAmount, currency)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-900">
                <span>Neto a Pagar:</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(payload.totals.netPayable, currency)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer Metadata */}
      <div className="mt-4 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
        <span>
          Plantilla: {template} ({payload.templateVersion}) · Formato: {paper}
        </span>
        <span>BWP NEXO · Autoimpresor por sistema computarizado</span>
      </div>
    </div>
  );
}
