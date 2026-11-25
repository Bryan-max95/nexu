// Server & client exact decimal arithmetic and Honduran SAR fiscal calculation engine
// Uses integer scaled arithmetic (BigInt scaled by 10^6) to avoid IEEE 754 floating-point drift.

export type TaxTreatment =
  | 'ISV_15'
  | 'ISV_18'
  | 'EXENTO'
  | 'EXONERADO'
  | 'ALICUOTA_CERO';

export type DocumentType =
  | 'FACTURA'
  | 'RECIBO'
  | 'NOTA_CREDITO'
  | 'NOTA_DEBITO'
  | 'COTIZACION'
  | 'RECIBO_HONORARIOS';

export interface LineItemInput {
  id?: string;
  quantity: string | number;
  description: string;
  unitPrice: string | number;
  discount: string | number; // exact currency discount on this line
  taxTreatment: TaxTreatment;
}

export interface CalculatedLineItem {
  id: string;
  quantity: string;
  description: string;
  unitPrice: string;
  discount: string;
  grossAmount: string;
  netBeforeGeneralDiscount: string;
  allocatedGeneralDiscount: string;
  baseAmount: string;
  taxRatePercent: number;
  taxAmount: string;
  lineTotal: string;
  taxTreatment: TaxTreatment;
}

export interface FiscalCalculationResult {
  items: CalculatedLineItem[];
  subtotalGross: string;
  lineDiscountsTotal: string;
  generalDiscount: string;
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
}

const SCALE = BigInt(1_000_000); // 6 decimal places internal precision
const CENTS_DIVISOR = BigInt(10_000); // 10^6 / 10^4 = 10^2 (2 decimal places)

export class ExactDecimal {
  private readonly scaled: bigint;

  private constructor(scaled: bigint) {
    this.scaled = scaled;
  }

  static from(value: string | number | bigint | ExactDecimal): ExactDecimal {
    if (value instanceof ExactDecimal) return value;
    if (typeof value === 'bigint') return new ExactDecimal(value * SCALE);
    const str = String(value ?? '0').trim().replace(/,/g, '');
    if (!str || str === '-') return new ExactDecimal(BigInt(0));
    const negative = str.startsWith('-');
    const clean = negative ? str.slice(1) : str;
    const [intPartRaw, fracPartRaw = ''] = clean.split('.');
    const intPart = BigInt(intPartRaw || '0');
    const paddedFrac = (fracPartRaw + '0000000').slice(0, 7);
    const frac6 = BigInt(paddedFrac.slice(0, 6));
    const seventhDigit = Number(paddedFrac[6] || '0');
    let total = intPart * SCALE + frac6;
    if (seventhDigit >= 5) {
      total += BigInt(1);
    }
    return new ExactDecimal(negative ? -total : total);
  }

  add(other: ExactDecimal | string | number): ExactDecimal {
    return new ExactDecimal(this.scaled + ExactDecimal.from(other).scaled);
  }

  sub(other: ExactDecimal | string | number): ExactDecimal {
    return new ExactDecimal(this.scaled - ExactDecimal.from(other).scaled);
  }

  mul(other: ExactDecimal | string | number): ExactDecimal {
    const o = ExactDecimal.from(other);
    const prod = this.scaled * o.scaled;
    const half = SCALE / BigInt(2);
    const rounded = prod >= BigInt(0) ? (prod + half) / SCALE : (prod - half) / SCALE;
    return new ExactDecimal(rounded);
  }

  div(other: ExactDecimal | string | number): ExactDecimal {
    const o = ExactDecimal.from(other);
    if (o.scaled === BigInt(0)) {
      throw new Error('División por cero no permitida en cálculo fiscal.');
    }
    const num = this.scaled * SCALE * BigInt(10);
    const quotient10 = num / o.scaled;
    const rem = quotient10 % BigInt(10);
    let quotient = quotient10 / BigInt(10);
    if (rem >= BigInt(5)) quotient += BigInt(1);
    else if (rem <= BigInt(-5)) quotient -= BigInt(1);
    return new ExactDecimal(quotient);
  }

  isNegative(): boolean {
    return this.scaled < BigInt(0);
  }

  isZero(): boolean {
    return this.scaled === BigInt(0);
  }

  gt(other: ExactDecimal | string | number): boolean {
    return this.scaled > ExactDecimal.from(other).scaled;
  }

  gte(other: ExactDecimal | string | number): boolean {
    return this.scaled >= ExactDecimal.from(other).scaled;
  }

  lt(other: ExactDecimal | string | number): boolean {
    return this.scaled < ExactDecimal.from(other).scaled;
  }

  round2(): ExactDecimal {
    const half = CENTS_DIVISOR / BigInt(2);
    const cents =
      this.scaled >= BigInt(0)
        ? (this.scaled + half) / CENTS_DIVISOR
        : (this.scaled - half) / CENTS_DIVISOR;
    return new ExactDecimal(cents * CENTS_DIVISOR);
  }

  toFixed2(): string {
    const r = this.round2();
    const neg = r.scaled < BigInt(0);
    const absCents = (neg ? -r.scaled : r.scaled) / CENTS_DIVISOR;
    const intPart = absCents / BigInt(100);
    const fracPart = absCents % BigInt(100);
    return `${neg ? '-' : ''}${intPart.toString()}.${fracPart.toString().padStart(2, '0')}`;
  }

  toNumber(): number {
    return Number(this.toFixed2());
  }
}

export function formatCurrency(amount: string | number, currency: 'HNL' | 'USD' = 'HNL'): string {
  const fixed = ExactDecimal.from(amount).toFixed2();
  const [intPart, decPart] = fixed.split('.');
  const neg = intPart.startsWith('-');
  const digits = neg ? intPart.slice(1) : intPart;
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = currency === 'USD' ? 'US$ ' : 'L ';
  return `${neg ? '-' : ''}${symbol}${withCommas}.${decPart}`;
}

export function calculateFiscalTotals(params: {
  items: LineItemInput[];
  taxIncluded: boolean;
  generalDiscount?: string | number;
  retencionAmount?: string | number;
  currency?: 'HNL' | 'USD';
}): FiscalCalculationResult {
  const {
    items,
    taxIncluded,
    generalDiscount = '0',
    retencionAmount = '0',
    currency = 'HNL',
  } = params;

  if (!items || items.length === 0) {
    throw new Error('El documento debe incluir al menos una línea de concepto.');
  }

  const genDiscountDec = ExactDecimal.from(generalDiscount).round2();
  const retencionDec = ExactDecimal.from(retencionAmount).round2();

  if (genDiscountDec.isNegative()) {
    throw new Error('El descuento general no puede ser negativo.');
  }
  if (retencionDec.isNegative()) {
    throw new Error('La retención no puede ser negativa.');
  }

  // First pass: validate lines and compute net before general discount
  let subtotalGross = ExactDecimal.from(0);
  let lineDiscountsTotal = ExactDecimal.from(0);
  let totalNetBeforeGenDiscount = ExactDecimal.from(0);

  const preItems = items.map((item, idx) => {
    const qty = ExactDecimal.from(item.quantity);
    const price = ExactDecimal.from(item.unitPrice);
    const disc = ExactDecimal.from(item.discount || 0).round2();

    if (qty.lteZero()) {
      throw new Error(`Línea ${idx + 1}: La cantidad debe ser mayor que cero.`);
    }
    if (price.isNegative()) {
      throw new Error(`Línea ${idx + 1}: El precio unitario no puede ser negativo.`);
    }
    if (disc.isNegative()) {
      throw new Error(`Línea ${idx + 1}: El descuento por línea no puede ser negativo.`);
    }

    const gross = qty.mul(price).round2();
    if (disc.gt(gross)) {
      throw new Error(`Línea ${idx + 1}: El descuento por línea supera el importe bruto.`);
    }

    const netBeforeGen = gross.sub(disc).round2();
    subtotalGross = subtotalGross.add(gross);
    lineDiscountsTotal = lineDiscountsTotal.add(disc);
    totalNetBeforeGenDiscount = totalNetBeforeGenDiscount.add(netBeforeGen);

    return {
      id: item.id || `line-${idx + 1}`,
      description: (item.description || '').trim(),
      qty,
      price,
      disc,
      gross,
      netBeforeGen,
      taxTreatment: item.taxTreatment,
    };
  });

  if (genDiscountDec.gt(totalNetBeforeGenDiscount)) {
    throw new Error('El descuento general no puede superar el subtotal neto de los conceptos.');
  }

  // Distribute general discount proportionally across lines
  let remainingGenDisc = genDiscountDec;
  let baseExenta = ExactDecimal.from(0);
  let baseExonerada = ExactDecimal.from(0);
  let baseAlicuotaCero = ExactDecimal.from(0);
  let baseGravada15 = ExactDecimal.from(0);
  let baseGravada18 = ExactDecimal.from(0);

  const calculatedItems: CalculatedLineItem[] = preItems.map((line, index) => {
    let allocatedGen = ExactDecimal.from(0);
    if (!genDiscountDec.isZero() && !totalNetBeforeGenDiscount.isZero()) {
      if (index === preItems.length - 1) {
        allocatedGen = remainingGenDisc;
      } else {
        allocatedGen = genDiscountDec
          .mul(line.netBeforeGen)
          .div(totalNetBeforeGenDiscount)
          .round2();
        if (allocatedGen.gt(remainingGenDisc)) {
          allocatedGen = remainingGenDisc;
        }
        remainingGenDisc = remainingGenDisc.sub(allocatedGen);
      }
    }

    const effectiveAmount = line.netBeforeGen.sub(allocatedGen).round2();
    let rateDec = ExactDecimal.from(0);
    let ratePercent = 0;

    if (line.taxTreatment === 'ISV_15') {
      rateDec = ExactDecimal.from('0.15');
      ratePercent = 15;
    } else if (line.taxTreatment === 'ISV_18') {
      rateDec = ExactDecimal.from('0.18');
      ratePercent = 18;
    }

    let baseAmount: ExactDecimal;
    let taxAmount: ExactDecimal;
    let lineTotal: ExactDecimal;

    if (taxIncluded && ratePercent > 0) {
      // Base = effectiveAmount / (1 + tasa)
      const divisor = ExactDecimal.from(1).add(rateDec);
      baseAmount = effectiveAmount.div(divisor).round2();
      taxAmount = effectiveAmount.sub(baseAmount).round2();
      lineTotal = effectiveAmount;
    } else {
      baseAmount = effectiveAmount;
      taxAmount = baseAmount.mul(rateDec).round2();
      lineTotal = baseAmount.add(taxAmount).round2();
    }

    switch (line.taxTreatment) {
      case 'EXENTO':
        baseExenta = baseExenta.add(baseAmount);
        break;
      case 'EXONERADO':
        baseExonerada = baseExonerada.add(baseAmount);
        break;
      case 'ALICUOTA_CERO':
        baseAlicuotaCero = baseAlicuotaCero.add(baseAmount);
        break;
      case 'ISV_15':
        baseGravada15 = baseGravada15.add(baseAmount);
        break;
      case 'ISV_18':
        baseGravada18 = baseGravada18.add(baseAmount);
        break;
    }

    return {
      id: line.id,
      quantity: line.qty.toFixed2(),
      description: line.description,
      unitPrice: line.price.toFixed2(),
      discount: line.disc.toFixed2(),
      grossAmount: line.gross.toFixed2(),
      netBeforeGeneralDiscount: line.netBeforeGen.toFixed2(),
      allocatedGeneralDiscount: allocatedGen.toFixed2(),
      baseAmount: baseAmount.toFixed2(),
      taxRatePercent: ratePercent,
      taxAmount: taxAmount.toFixed2(),
      lineTotal: lineTotal.toFixed2(),
      taxTreatment: line.taxTreatment,
    };
  });

  // Compute aggregate taxes on separated bases with consistent rounding
  const isv15 = baseGravada15.mul('0.15').round2();
  const isv18 = baseGravada18.mul('0.18').round2();
  const totalIsv = isv15.add(isv18).round2();

  const totalBases = baseExenta
    .add(baseExonerada)
    .add(baseAlicuotaCero)
    .add(baseGravada15)
    .add(baseGravada18)
    .round2();

  const totalFiscal = totalBases.add(totalIsv).round2();
  const totalDiscounts = lineDiscountsTotal.add(genDiscountDec).round2();
  // Retenciones separadas del ISV; no alteran indebidamente el total fiscal
  const netPayable = totalFiscal.sub(retencionDec).round2();

  return {
    items: calculatedItems,
    subtotalGross: subtotalGross.toFixed2(),
    lineDiscountsTotal: lineDiscountsTotal.toFixed2(),
    generalDiscount: genDiscountDec.toFixed2(),
    totalDiscounts: totalDiscounts.toFixed2(),
    baseExenta: baseExenta.toFixed2(),
    baseExonerada: baseExonerada.toFixed2(),
    baseAlicuotaCero: baseAlicuotaCero.toFixed2(),
    baseGravada15: baseGravada15.toFixed2(),
    baseGravada18: baseGravada18.toFixed2(),
    isv15: isv15.toFixed2(),
    isv18: isv18.toFixed2(),
    totalIsv: totalIsv.toFixed2(),
    totalFiscal: totalFiscal.toFixed2(),
    retencionAmount: retencionDec.toFixed2(),
    netPayable: netPayable.toFixed2(),
    totalInWords: numberToSpanishWords(totalFiscal.toFixed2(), currency),
  };
}

// Add helper on ExactDecimal prototype for <= 0
declare module './fiscal-engine' {
  interface ExactDecimal {
    lteZero(): boolean;
  }
}
ExactDecimal.prototype.lteZero = function () {
  return this.isNegative() || this.isZero();
};

// Convert numeric total to Spanish words for Honduran fiscal compliance
export function numberToSpanishWords(amountFixed: string, currency: 'HNL' | 'USD' = 'HNL'): string {
  const clean = ExactDecimal.from(amountFixed).toFixed2();
  const [intStr, centsStr = '00'] = clean.split('.');
  const n = parseInt(intStr.replace('-', ''), 10) || 0;

  const currencyLabel =
    currency === 'USD'
      ? n === 1
        ? 'DÓLAR ESTADOUNIDENSE'
        : 'DÓLARES ESTADOUNIDENSES'
      : n === 1
        ? 'LEMPIRA'
        : 'LEMPIRAS';

  const words = integerToSpanish(n);
  return `${words} ${currencyLabel} CON ${centsStr}/100`;
}

function integerToSpanish(n: number): string {
  if (n === 0) return 'CERO';

  const unidades = [
    '',
    'UN',
    'DOS',
    'TRES',
    'CUATRO',
    'CINCO',
    'SEIS',
    'SIETE',
    'OCHO',
    'NUEVE',
    'DIEZ',
    'ONCE',
    'DOCE',
    'TRECE',
    'CATORCE',
    'QUINCE',
    'DIECISÉIS',
    'DIECISIETE',
    'DIECIOCHO',
    'DIECINUEVE',
    'VEINTE',
    'VEINTIÚN',
    'VEINTIDÓS',
    'VEINTITRÉS',
    'VEINTICUATRO',
    'VEINTICINCO',
    'VEINTISÉIS',
    'VEINTISIETE',
    'VEINTIOCHO',
    'VEINTINUEVE',
  ];

  const decenas = [
    '',
    'DIEZ',
    'VEINTE',
    'TREINTA',
    'CUARENTA',
    'CINCUENTA',
    'SESENTA',
    'SETENTA',
    'OCHENTA',
    'NOVENTA',
  ];

  const centenas = [
    '',
    'CIENTO',
    'DOSCIENTOS',
    'TRESCIENTOS',
    'CUATROCIENTOS',
    'QUINIENTOS',
    'SEISCIENTOS',
    'SETECIENTOS',
    'OCHOCIENTOS',
    'NOVECIENTOS',
  ];

  function convertUnder1000(val: number): string {
    if (val === 0) return '';
    if (val === 100) return 'CIEN';
    const c = Math.floor(val / 100);
    const rem = val % 100;
    let out = centenas[c];
    if (rem > 0) {
      if (out) out += ' ';
      if (rem < 30) {
        out += unidades[rem];
      } else {
        const d = Math.floor(rem / 10);
        const u = rem % 10;
        out += decenas[d] + (u > 0 ? ` Y ${unidades[u]}` : '');
      }
    }
    return out;
  }

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  const parts: string[] = [];
  if (millions > 0) {
    if (millions === 1) parts.push('UN MILLÓN');
    else parts.push(`${convertUnder1000(millions)} MILLONES`);
  }
  if (thousands > 0) {
    if (thousands === 1) parts.push('UN MIL');
    else parts.push(`${convertUnder1000(thousands)} MIL`);
  }
  if (remainder > 0) {
    parts.push(convertUnder1000(remainder));
  }

  return parts.join(' ').trim();
}

// Timezone utilities strictly anchored to America/Tegucigalpa (Section 8.1 & 27)
export function getHondurasDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // YYYY-MM-DD
}

export function formatHondurasDateDisplay(yyyyMmDd: string): string {
  if (!yyyyMmDd) return '';
  const parts = yyyyMmDd.split('-');
  if (parts.length !== 3) return yyyyMmDd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
}

export function calculateDaysRemaining(limitDateYyyyMmDd: string, currentYyyyMmDd?: string): number {
  const todayStr = currentYyyyMmDd || getHondurasDateString();
  const [y1, m1, d1] = todayStr.split('-').map(Number);
  const [y2, m2, d2] = limitDateYyyyMmDd.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((t2 - t1) / (1000 * 60 * 60 * 24));
}

export interface CaiVigenciaAlert {
  level: 'OK' | 'RECORDATORIO' | 'PROXIMO' | 'IMPORTANTE' | 'URGENTE' | 'INMINENTE' | 'UN_DIA' | 'VENCIDO';
  daysRemaining: number;
  label: string;
  blocksEmission: boolean;
}

// Section 8.2: Alertas por vigencia
export function evaluateCaiVigencia(limitDateYyyyMmDd: string): CaiVigenciaAlert {
  const days = calculateDaysRemaining(limitDateYyyyMmDd);
  if (days < 0) {
    return {
      level: 'VENCIDO',
      daysRemaining: days,
      label: 'Vencido · Bloquear nueva emisión',
      blocksEmission: true,
    };
  }
  if (days === 0 || days === 1) {
    return {
      level: 'UN_DIA',
      daysRemaining: days,
      label: days === 0 ? 'Vence hoy · Último día habilitado' : '1 día restante · Renovar de inmediato',
      blocksEmission: false,
    };
  }
  if (days <= 3) {
    return {
      level: 'INMINENTE',
      daysRemaining: days,
      label: `Inminente (${days} días restantes)`,
      blocksEmission: false,
    };
  }
  if (days <= 7) {
    return {
      level: 'URGENTE',
      daysRemaining: days,
      label: `Urgente (${days} días restantes)`,
      blocksEmission: false,
    };
  }
  if (days <= 15) {
    return {
      level: 'IMPORTANTE',
      daysRemaining: days,
      label: `Advertencia importante (${days} días restantes)`,
      blocksEmission: false,
    };
  }
  if (days <= 30) {
    return {
      level: 'PROXIMO',
      daysRemaining: days,
      label: `Próximo a vencer (${days} días restantes)`,
      blocksEmission: false,
    };
  }
  if (days <= 60) {
    return {
      level: 'RECORDATORIO',
      daysRemaining: days,
      label: `Recordatorio de renovación (${days} días restantes)`,
      blocksEmission: false,
    };
  }
  return {
    level: 'OK',
    daysRemaining: days,
    label: `Vigente (${days} días restantes)`,
    blocksEmission: false,
  };
}

// Section 8.3: Alertas por cantidad
export interface CaiQuantityAlert {
  level: 'OK' | 'INFO' | 'ADVERTENCIA' | 'CRITICA' | 'AGOTADO';
  available: number;
  label: string;
  blocksEmission: boolean;
}

export function evaluateCaiQuantity(available: number): CaiQuantityAlert {
  if (available <= 0) {
    return {
      level: 'AGOTADO',
      available: 0,
      label: '0 disponibles · Bloquear emisión',
      blocksEmission: true,
    };
  }
  if (available <= 5) {
    return {
      level: 'CRITICA',
      available,
      label: `Crítica (${available} disponibles)`,
      blocksEmission: false,
    };
  }
  if (available <= 20) {
    return {
      level: 'ADVERTENCIA',
      available,
      label: `Advertencia / urgente (${available} disponibles)`,
      blocksEmission: false,
    };
  }
  if (available <= 100) {
    return {
      level: 'INFO',
      available,
      label: `Información / solicitar nueva autorización (${available} disponibles)`,
      blocksEmission: false,
    };
  }
  return {
    level: 'OK',
    available,
    label: `${available} disponibles`,
    blocksEmission: false,
  };
}

export function formatFiscalNumber(
  establishment: string,
  emissionPoint: string,
  docTypeCode: string,
  correlative: number
): string {
  const est = establishment.trim().padStart(3, '0');
  const pt = emissionPoint.trim().padStart(3, '0');
  const dt = docTypeCode.trim().padStart(2, '0');
  const num = String(correlative).padStart(8, '0');
  return `${est}-${pt}-${dt}-${num}`;
}

export function validateCaiFormat(cai: string): boolean {
  // Format: XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX (alphanumeric uppercase)
  const regex = /^[A-Z0-9]{6}(-[A-Z0-9]{6}){4}-[A-Z0-9]{2}$/;
  return regex.test(cai.trim().toUpperCase());
}

export function validateHondurasRtn(rtn: string): boolean {
  // 14 digits preserving leading zeros
  return /^\d{14}$/.test(rtn.trim());
}
