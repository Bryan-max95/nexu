import crypto from 'crypto';
import { formatCurrency, formatHondurasDateDisplay } from './fiscal-engine';

export type TemplateId = 'CLASICA' | 'CORPORATIVA' | 'MINIMALISTA';
export type PaperSize = 'LETTER' | 'A4';

export interface PdfDocumentPayload {
  id: string;
  docType: string;
  docTypeLabel: string;
  fiscalNumber: string;
  status: 'BORRADOR' | 'EMITIDO' | 'ANULADO';
  issueDateLocal: string;
  currency: 'HNL' | 'USD';
  paymentMethod: string;
  paymentCondition: string;
  templateUsed: TemplateId;
  templateVersion: string;
  paperSize: PaperSize;
  copyLabel?: string; // e.g. 'ORIGINAL - CLIENTE / COPIA - OBLIGADO TRIBUTARIO EMISOR'
  companySnapshot: {
    legalName: string;
    commercialName: string;
    rtn: string;
    addressMatriz: string;
    addressEstablecimiento: string;
    department: string;
    municipality: string;
    phone: string;
    whatsapp: string;
    email: string;
    website?: string;
    economicActivity: string;
    representative: string;
    modality: string;
    primaryColor: string;
    secondaryColor: string;
    footerMessage: string;
    bankInfo?: string;
  };
  caiSnapshot?: {
    cai: string;
    rangeStartFormatted: string;
    rangeEndFormatted: string;
    authDate: string;
    limitDate: string;
  } | null;
  clientSnapshot: {
    name: string;
    rtn: string;
    idDoc?: string;
    address?: string;
    phone?: string;
    email?: string;
    isFinalConsumer: boolean;
    exoneratedOrder?: string;
    exoneratedRegistry?: string;
    exoneratedSag?: string;
  };
  relatedDocSnapshot?: {
    fiscalNumber: string;
    cai: string;
    issueDate: string;
    reason: string;
  } | null;
  cancellationSnapshot?: {
    reason: string;
    cancelledBy: string;
    cancelledAt: string;
  } | null;
  items: Array<{
    quantity: string;
    description: string;
    unitPrice: string;
    discount: string;
    baseAmount: string;
    taxRatePercent: number;
    taxAmount: string;
    lineTotal: string;
    taxTreatment: string;
  }>;
  totals: {
    subtotalGross: string;
    totalDiscounts: string;
    baseExenta: string;
    baseExonerada: string;
    baseAlicuotaCero: string;
    baseGravada15: string;
    baseGravada18: string;
    isv15: string;
    isv18: string;
    totalIsv: string;
    totalFiscal: string;
    retencionAmount: string;
    netPayable: string;
    totalInWords: string;
  };
}

// Convert UTF-8 Spanish text into WinAnsi (ISO-8859-1) escaped PDF literal string
function pdfEscapeWinAnsi(text: string): string {
  const safe = String(text ?? '')
    .replace(/·/g, '-')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "'");
  let out = '';
  for (let i = 0; i < safe.length; i++) {
    const code = safe.charCodeAt(i);
    if (safe[i] === '(' || safe[i] === ')' || safe[i] === '\\') {
      out += '\\' + safe[i];
    } else if (code >= 32 && code <= 126) {
      out += safe[i];
    } else if (code >= 160 && code <= 255) {
      out += '\\' + code.toString(8).padStart(3, '0');
    } else {
      out += ' ';
    }
  }
  return out;
}

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = (hex || '#7A1C24').replace('#', '').trim();
  if (clean.length !== 6) return [0.478, 0.11, 0.141]; // #7A1C24
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? Number(r.toFixed(3)) : 0.478,
    Number.isFinite(g) ? Number(g.toFixed(3)) : 0.11,
    Number.isFinite(b) ? Number(b.toFixed(3)) : 0.141,
  ];
}

export function getPdfFilename(doc: { docType: string; fiscalNumber: string }): string {
  const cleanNum = (doc.fiscalNumber || 'BORRADOR').replace(/[^A-Za-z0-9-_]/g, '_');
  const prefix =
    doc.docType === 'FACTURA'
      ? 'FACTURA'
      : doc.docType === 'RECIBO'
        ? 'RECIBO'
        : doc.docType === 'COTIZACION'
          ? 'COTIZACION'
          : doc.docType === 'NOTA_CREDITO'
            ? 'NOTA_CREDITO'
            : doc.docType === 'NOTA_DEBITO'
              ? 'NOTA_DEBITO'
              : 'DOCUMENTO';
  return `${prefix}_${cleanNum}.pdf`;
}

export function generateServerPdf(payload: PdfDocumentPayload): {
  buffer: Buffer;
  sha256Hash: string;
  filename: string;
  pageCount: number;
} {
  const width = payload.paperSize === 'A4' ? 595 : 612;
  const height = payload.paperSize === 'A4' ? 842 : 792;
  const margin = 40;
  const right = width - margin;
  const contentWidth = right - margin;
  const accent = payload.templateUsed === 'CORPORATIVA' ? hexToRgbNormalized(payload.companySnapshot.primaryColor) : [0.15, 0.15, 0.17];
  const pageStreams: string[] = [];
  const pages: string[][] = [];
  let ops: string[] = [];
  let y = 0;
  const wrap = (value: string, maxWidth: number, size = 9): string[] => {
    const max = Math.max(1, Math.floor(maxWidth / (size * 0.57)));
    const words = String(value || '').replace(/[\r\n]+/g, ' ').split(/\s+/);
    const lines: string[] = []; let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = ''; }
      for (let i = 0; i < word.length; i += max) {
        const part = word.slice(i, i + max);
        if (i + max < word.length) { if (line) lines.push(line); lines.push(part); line = ''; }
        else line = (line + ' ' + part).trim();
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  const text = (value: string, x: number, top: number, size = 9, bold = false) => {
    ops.push(`BT /F${bold ? '2' : '1'} ${size} Tf ${x} ${top} Td (${pdfEscapeWinAnsi(value)}) Tj ET`);
  };
  const block = (value: string, x: number, top: number, w: number, size = 9, bold = false) => {
    const lines = wrap(value, w, size); lines.forEach((line, i) => text(line, x, top - i * (size + 4), size, bold));
    return lines.length * (size + 4);
  };
  const rule = () => { ops.push(`0.85 0.85 0.87 RG 0.5 w ${margin} ${y} m ${right} ${y} l S`); y -= 16; };
  const tableHeader = () => {
    ops.push(`${accent.join(' ')} rg ${margin} ${y - 23} ${contentWidth} 23 re f 1 1 1 rg`);
    text('CANT.', margin + 6, y - 15, 8, true); text('DESCRIPCIÓN', margin + 50, y - 15, 8, true);
    text('PRECIO', right - 188, y - 15, 8, true); text('DESC.', right - 130, y - 15, 8, true);
    text('ISV', right - 84, y - 15, 8, true); text('BASE', right - 42, y - 15, 8, true);
    ops.push('0.12 0.12 0.14 rg'); y -= 36;
  };
  const startPage = (continuation = false) => {
    if (ops.length) pages.push(ops); ops = []; y = height - margin;
    ops.push('q');
    ops.push(`${accent.join(' ')} rg ${margin} ${y - 5} ${contentWidth} 4 re f`); y -= 30;
    ops.push('0.1 0.1 0.12 rg');
    y -= block(payload.companySnapshot.commercialName || payload.companySnapshot.legalName, margin, y, contentWidth, 17, true);
    y -= block(`${payload.companySnapshot.legalName} · RTN ${payload.companySnapshot.rtn}`, margin, y, contentWidth, 9);
    y -= block(`${payload.companySnapshot.addressMatriz}, ${payload.companySnapshot.municipality}, ${payload.companySnapshot.department}`, margin, y, contentWidth, 8);
    y -= block(`Tel. ${payload.companySnapshot.phone} · ${payload.companySnapshot.email}`, margin, y, contentWidth, 8); y -= 8;
    rule();
    ops.push(`${accent.join(' ')} rg`);
    y -= block(`${payload.docTypeLabel.toUpperCase()} · ${payload.fiscalNumber}`, margin, y, contentWidth, 13, true);
    ops.push('0.12 0.12 0.14 rg');
    y -= block(`Fecha: ${formatHondurasDateDisplay(payload.issueDateLocal)} · Moneda: ${payload.currency} · Pago: ${payload.paymentMethod} / ${payload.paymentCondition}`, margin, y, contentWidth, 8);
    if (payload.status !== 'EMITIDO') { ops.push('0.65 0.1 0.1 rg'); y -= block(payload.status === 'BORRADOR' ? 'BORRADOR - SIN VALIDEZ FISCAL' : 'DOCUMENTO ANULADO', margin, y, contentWidth, 11, true); ops.push('0.12 0.12 0.14 rg'); }
    if (payload.caiSnapshot) {
      const cai = payload.caiSnapshot;
      y -= block(`CAI: ${cai.cai}`, margin, y, contentWidth, 8, true);
      y -= block(`Rango autorizado: ${cai.rangeStartFormatted} al ${cai.rangeEndFormatted}`, margin, y, contentWidth, 8);
      y -= block(`Autorización: ${formatHondurasDateDisplay(cai.authDate)} · Límite de emisión: ${formatHondurasDateDisplay(cai.limitDate)}`, margin, y, contentWidth, 8);
      y -= block(`Establecimiento: ${payload.companySnapshot.addressEstablecimiento} · ${payload.companySnapshot.modality}`, margin, y, contentWidth, 8);
    } else y -= block('DOCUMENTO NO FISCAL - NO SUSTITUYE UNA FACTURA', margin, y, contentWidth, 8, true);
    y -= 8; rule();
    y -= block(`Cliente: ${payload.clientSnapshot.name} · RTN: ${payload.clientSnapshot.rtn || 'Consumidor final'}`, margin, y, contentWidth, 9, true);
    if (!continuation) {
      y -= block(payload.clientSnapshot.address || '', margin, y, contentWidth, 8);
      y -= block(`Correo: ${payload.clientSnapshot.email || '-'} · Teléfono: ${payload.clientSnapshot.phone || '-'}`, margin, y, contentWidth, 8);
      if (payload.clientSnapshot.exoneratedOrder || payload.clientSnapshot.exoneratedRegistry || payload.clientSnapshot.exoneratedSag) y -= block(`Orden exenta: ${payload.clientSnapshot.exoneratedOrder || '-'} · Registro: ${payload.clientSnapshot.exoneratedRegistry || '-'} · SAG: ${payload.clientSnapshot.exoneratedSag || '-'}`,margin,y,contentWidth,8);
      if (payload.relatedDocSnapshot) y -= block(`Documento relacionado: ${payload.relatedDocSnapshot.fiscalNumber} · Motivo: ${payload.relatedDocSnapshot.reason}`,margin,y,contentWidth,8);
      if (payload.cancellationSnapshot) y -= block(`Anulación: ${payload.cancellationSnapshot.reason} · ${payload.cancellationSnapshot.cancelledBy} · ${payload.cancellationSnapshot.cancelledAt}`,margin,y,contentWidth,8);
    }
    y -= 8; tableHeader();
  };
  startPage();
  payload.items.forEach((item, index) => {
    const lines = wrap(item.description, contentWidth - 250, 8);
    let cursor = 0;
    do {
      if (y < 145) startPage(true);
      const take = Math.min(lines.length - cursor, Math.max(1, Math.floor((y - 125) / 12)));
      const rowHeight = Math.max(25, take * 12 + 12);
      if (index % 2 === 0 && payload.templateUsed !== 'MINIMALISTA') ops.push(`0.965 0.965 0.975 rg ${margin} ${y - rowHeight + 10} ${contentWidth} ${rowHeight} re f`);
      ops.push('0.12 0.12 0.14 rg');
      if (cursor === 0) {
        text(item.quantity, margin + 6, y, 8);
        text(item.unitPrice, right - 188, y, 8); text(item.discount, right - 130, y, 8);
        text(`${item.taxRatePercent}%`, right - 84, y, 8); text(item.baseAmount, right - 42, y, 8);
      }
      lines.slice(cursor, cursor + take).forEach((line, i) => text(line, margin + 50, y - i * 12, 8));
      y -= rowHeight; cursor += take;
      if (cursor < lines.length) startPage(true);
    } while (cursor < lines.length);
  });
  if (y < 320) startPage(true);
  rule();
  const summary: Array<[string,string]> = [
    ['Descuentos',payload.totals.totalDiscounts],['Importe exento',payload.totals.baseExenta],
    ['Importe exonerado',payload.totals.baseExonerada],['Alícuota cero',payload.totals.baseAlicuotaCero],
    ['Gravado 15%',payload.totals.baseGravada15],['Gravado 18%',payload.totals.baseGravada18],
    ['ISV 15%',payload.totals.isv15],['ISV 18%',payload.totals.isv18],['TOTAL FISCAL',payload.totals.totalFiscal],
    ['Retención',payload.totals.retencionAmount],['NETO A PAGAR',payload.totals.netPayable],
  ];
  const summaryTop = y;
  summary.forEach(([label,value],i)=>{text(label,right-210,summaryTop-i*16,9,i===8 || i===10); text(formatCurrency(value,payload.currency),right-85,summaryTop-i*16,9,i===8 || i===10);});
  let leftY = y;
  leftY -= block('SON: ' + payload.totals.totalInWords,margin,leftY,contentWidth-230,9,true);
  if (payload.companySnapshot.bankInfo) block('Datos bancarios: '+payload.companySnapshot.bankInfo,margin,leftY-12,contentWidth-230,8);
  pages.push(ops);
  const totalPages = pages.length;
  pages.forEach((page,index)=>{
    ops=page; ops.push('0.4 0.4 0.43 rg');
    block(payload.copyLabel || 'Original: Cliente · Copia: Obligado Tributario Emisor',margin,76,contentWidth,8,true);
    block(payload.companySnapshot.footerMessage || 'La factura es beneficio de todos. Exíjala.',margin,60,contentWidth-100,7);
    text(`Pág. ${index+1} de ${totalPages}`,right-65,40,8);
    text('BWP NEXO',margin,30,7); ops.push('Q'); pageStreams.push(ops.join('\n'));
  });

  // Assemble valid multi-page PDF 1.4 binary
  // Objects:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5: Font F3 (Courier)
  // Then for each page i:
  //   6 + i*2: Page object
  //   7 + i*2: Content stream object
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  for (let i = 0; i < totalPages; i++) {
    pageObjectIds.push(6 + i * 2);
  }

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${totalPages} >>\nendobj`
  );
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj');

  pageStreams.forEach((streamContent, idx) => {
    const pageObjId = 6 + idx * 2;
    const streamObjId = 7 + idx * 2;
    const streamByteLength = Buffer.byteLength(streamContent, 'latin1');

    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${streamObjId} 0 R >>\nendobj`
    );
    objects.push(
      `${streamObjId} 0 obj\n<< /Length ${streamByteLength} >>\nstream\n${streamContent}\nendstream\nendobj`
    );
  });

  let pdfContent = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdfContent, 'latin1'));
    pdfContent += obj + '\n';
  }

  const xrefOffset = Buffer.byteLength(pdfContent, 'latin1');
  pdfContent += `xref\n0 ${objects.length + 1}\n`;
  pdfContent += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdfContent += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfContent += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const buffer = Buffer.from(pdfContent, 'latin1');
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    buffer,
    sha256Hash,
    filename: getPdfFilename({ docType: payload.docType, fiscalNumber: payload.fiscalNumber }),
    pageCount: totalPages,
  };
}
