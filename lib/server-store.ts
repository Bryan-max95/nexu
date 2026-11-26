import crypto from 'crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

import {
  calculateDaysRemaining,
  calculateFiscalTotals,
  DocumentType,
  evaluateCaiQuantity,
  evaluateCaiVigencia,
  FiscalCalculationResult,
  formatFiscalNumber,
  getHondurasDateString,
  LineItemInput,
  validateCaiFormat,
  validateHondurasRtn,
} from './fiscal-engine';
import { generateServerPdf, PaperSize, PdfDocumentPayload, TemplateId } from './pdf-generator';

export type CompanyRole = 'PROPIETARIO' | 'FACTURADOR' | 'CONSULTA';
export type SubscriptionStatus =
  | 'PENDIENTE_ACTIVACION'
  | 'ACTIVA'
  | 'PROXIMA_A_VENCER'
  | 'VENCIDA'
  | 'SUSPENDIDA'
  | 'CANCELADA';

export type CaiStatus =
  | 'PENDIENTE'
  | 'ACTIVO'
  | 'PROXIMO_A_VENCER'
  | 'AGOTADO'
  | 'VENCIDO'
  | 'CANCELADO'
  | 'ARCHIVADO';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  passwordHash: string;
  passwordSalt: string;
  emailVerified: boolean;
  verificationToken?: string;
  verificationExpiresAt?: string;
  resetToken?: string;
  resetExpiresAt?: string;
  isSuperAdmin: boolean;
  mfaEnabled: boolean;
  termsAcceptedVersion: string;
  termsAcceptedAtUtc: string;
  createdAtUtc: string;
}

export interface CompanyRecord {
  id: string;
  legalName: string;
  commercialName: string;
  rtn: string; // 14 digits preserving leading zeros
  addressMatriz: string;
  addressEstablecimiento: string;
  department: string;
  municipality: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  economicActivity: string;
  representative: string;
  contributorType: 'PERSONA_NATURAL' | 'PERSONA_JURIDICA';
  modality: string;
  establishmentCode: string; // e.g. '000'
  emissionPointCode: string; // e.g. '001'
  primaryColor: string;
  secondaryColor: string;
  footerMessage: string;
  bankInfo: string;
  paymentTerms: string;
  paperSize: PaperSize;
  defaultTemplate: TemplateId;
  templateVersion: string;
  logoText: string;
  logoDataUrl?: string;
  createdAtUtc: string;
}

export interface CompanyMemberRecord {
  id: string;
  companyId: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: CompanyRole;
  canExport: boolean;
  status: 'ACTIVO' | 'REVOCADO';
  invitedAtUtc: string;
}

export interface FiscalAuthorizationRecord {
  id: string;
  companyId: string;
  docType: DocumentType;
  cai: string;
  establishment: string; // '000'
  emissionPoint: string; // '001'
  docTypeCode: string; // '01' factura, '06' nota credito, '07' nota debito
  rangeStart: number;
  rangeEnd: number;
  lastUsed: number; // 0 if none used yet, or migrated initial value
  migratedInitialLastUsed?: number;
  authDate: string; // YYYY-MM-DD
  limitDate: string; // YYYY-MM-DD
  supportPdfName: string;
  supportPdfDataUrl?: string;
  status: CaiStatus;
  createdAtUtc: string;
}

export interface DocumentRecord {
  id: string;
  companyId: string;
  docType: DocumentType;
  fiscalNumber: string; // e.g. '000-001-01-00000087' or 'BORRADOR-...' or 'REC-00000015'
  correlativeInt?: number;
  caiId?: string | null;
  caiCode?: string | null;
  status: 'BORRADOR' | 'EMITIDO' | 'ANULADO';
  issueDateLocal: string; // YYYY-MM-DD America/Tegucigalpa
  createdAtUtc: string;
  issuedAtUtc?: string;
  currency: 'HNL' | 'USD';
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO';
  paymentCondition: string;
  taxIncluded: boolean;
  generalDiscount: string;
  retencionAmount: string;
  clientName: string;
  clientRtn: string;
  clientIdDoc: string;
  clientAddress: string;
  clientPhone: string;
  clientWhatsapp: string;
  clientEmail: string;
  isFinalConsumer: boolean;
  exoneratedOrder: string;
  exoneratedRegistry: string;
  exoneratedSag: string;
  relatedDocumentId?: string | null;
  relatedFiscalNumber?: string | null;
  relatedReason?: string;
  templateUsed: TemplateId;
  templateVersion: string;
  paperSize: PaperSize;
  items: FiscalCalculationResult['items'];
  totals: Omit<FiscalCalculationResult, 'items'>;
  // Immutable snapshot captured at emission time (Section 7 & 23)
  snapshot: PdfDocumentPayload;
  pdfStatus: 'PENDIENTE' | 'GENERADO' | 'ERROR';
  pdfHash?: string;
  pdfVersion: number;
  pdfFilename?: string;
  cancellation?: {
    reason: string;
    userId: string;
    userName: string;
    cancelledAtUtc: string;
  } | null;
}

export interface SubscriptionRecord {
  id: string;
  companyId: string;
  planName: string;
  activationFeeHnl: string; // '4000.00'
  monthlyFeeHnl: string; // '350.00'
  activationPaid: boolean;
  status: SubscriptionStatus;
  currentPeriodStart: string; // YYYY-MM-DD
  nextPaymentDate: string; // YYYY-MM-DD
  graceDays: number;
  updatedAtUtc: string;
}

export interface SubscriptionPaymentRecord {
  id: string;
  companyId: string;
  companyName: string;
  companyRtn: string;
  paymentType: 'ACTIVACION_UNICA' | 'MENSUALIDAD';
  amountHnl: string;
  bankReference: string;
  bankName: string;
  receiptFilename: string;
  receiptDataUrl?: string;
  notes: string;
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAtUtc?: string;
  createdAtUtc: string;
}

export interface NotificationRecord {
  id: string;
  companyId: string;
  dedupKey: string; // companyId:event:authId:threshold
  type: 'CAI_VIGENCIA' | 'CAI_CANTIDAD' | 'SUSCRIPCION' | 'PAGO' | 'SEGURIDAD' | 'COMUNICADO';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  channel: 'PANEL_Y_CORREO' | 'PANEL';
  deliveryStatus: 'ENTREGADO' | 'PENDIENTE' | 'REINTENTO';
  read: boolean;
  createdAtUtc: string;
}

export interface AuditLogRecord {
  id: string;
  companyId: string | null;
  actorId: string;
  actorName: string;
  actorRole: string;
  operation: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAtUtc: string;
}

export interface DocumentShareLinkRecord {
  id: string;
  companyId: string;
  documentId: string;
  tokenHash: string;
  tokenPreview: string;
  expiresAtUtc: string;
  revoked: boolean;
  createdByUserId: string;
  createdAtUtc: string;
}

export interface IntegrationSettingRecord {
  companyId: string;
  enabled: boolean;
  adapterType: 'WEBHOOK_CONTABLE' | 'API_EXTERNA_REST' | 'EXPORTACION_CONCILIADA';
  endpointUrl: string;
  accountSales15: string;
  accountSales18: string;
  accountSalesExempt: string;
  accountIsv15: string;
  accountIsv18: string;
  accountReceivable: string;
  updatedAtUtc: string;
}

export interface IntegrationEventRecord {
  id: string;
  companyId: string;
  documentId: string;
  fiscalNumber: string;
  eventType: 'DOCUMENTO_EMITIDO' | 'DOCUMENTO_ANULADO' | 'NOTA_AJUSTE';
  payloadSummary: string;
  externalReference: string;
  attempts: number;
  status: 'CONCILIADO' | 'PENDIENTE' | 'ERROR_REINTENTABLE';
  lastError?: string;
  updatedAtUtc: string;
}

export interface IdempotencyRecord {
  key: string;
  companyId: string;
  payloadHash: string;
  documentId: string;
  createdAtUtc: string;
}

export interface SupportTicketRecord {
  id: string;
  companyId: string;
  companyName: string;
  subject: string;
  message: string;
  status: 'ABIERTO' | 'EN_REVISION' | 'RESUELTO';
  adminJustification?: string;
  createdAtUtc: string;
}

export interface SystemConfigRecord {
  activationPriceHnl: string;
  monthlyPriceHnl: string;
  graceDays: number;
  pricesIncludeTax: boolean;
  bankInstructions: string;
  supportWhatsapp: string;
  supportEmail: string;
  honorariosEnabled: boolean;
  superadminPasscodeHash?: string;
  superadminPasscodeSalt?: string;
}

export interface ClientRecord { id: string; companyId: string; name: string; rtn: string; address: string; whatsapp: string; email: string; }

export interface DatabaseState {
  sessions?: Array<{ id: string; userId: string; expiresAt: number }>;
  clients: ClientRecord[];
  users: UserRecord[];
  companies: CompanyRecord[];
  companyMembers: CompanyMemberRecord[];
  fiscalAuthorizations: FiscalAuthorizationRecord[];
  internalSequences: Record<string, { RECIBO: number; COTIZACION: number }>;
  documents: DocumentRecord[];
  subscriptions: SubscriptionRecord[];
  subscriptionPayments: SubscriptionPaymentRecord[];
  notifications: NotificationRecord[];
  auditLogs: AuditLogRecord[];
  shareLinks: DocumentShareLinkRecord[];
  integrationSettings: IntegrationSettingRecord[];
  integrationEvents: IntegrationEventRecord[];
  idempotencyKeys: IdempotencyRecord[];
  supportTickets: SupportTicketRecord[];
  systemConfig: SystemConfigRecord;
}

// Password hashing via Node crypto.scryptSync (Section 4 & 26)
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: computed } = hashPassword(password, salt);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Ephemeral + env session signing key (never hardcoded)
declare global {
  var _bwpSessionSecret: Buffer | undefined;
  var _bwpDbState: DatabaseState | undefined;
  var _bwpMutexChain: Promise<unknown> | undefined;
}

function getSessionSecret(): Buffer {
  if (process.env.SESSION_SECRET) return Buffer.from(process.env.SESSION_SECRET);
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET es obligatorio.');
  if (!global._bwpSessionSecret) {
    global._bwpSessionSecret = crypto.randomBytes(32);
  }
  return global._bwpSessionSecret;
}

export interface SessionTokenPayload {
  sessionId?: string;
  userId: string;
  email: string;
  name: string;
  companyId: string;
  role: CompanyRole;
  isSuperAdmin: boolean;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionTokenPayload, 'exp'>): string {
  const fullPayload: SessionTokenPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  };
  const dataB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

export function verifySessionToken(token?: string | null): SessionTokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [dataB64, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(dataB64)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!Number.isFinite(parsed.exp) || Date.now() >= parsed.exp || typeof parsed.userId !== 'string' || !parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Mutex lock for atomic correlative allocation (Section 8.1 & 25)
export async function withTransactionLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const prev = global._bwpMutexChain || Promise.resolve();
  let release!: () => void;
  global._bwpMutexChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export const databaseContext = new AsyncLocalStorage<DatabaseState>();

export function createInitialState(): DatabaseState {
  return {
    clients: [], users: [], companies: [], companyMembers: [], fiscalAuthorizations: [],
    internalSequences: {}, documents: [], subscriptions: [], subscriptionPayments: [],
    notifications: [], auditLogs: [], shareLinks: [], integrationSettings: [],
    integrationEvents: [], idempotencyKeys: [], supportTickets: [],
    systemConfig: {
      activationPriceHnl: '4000.00', monthlyPriceHnl: '350.00', graceDays: 3,
      pricesIncludeTax: true, bankInstructions: 'Solicite los datos de pago a soporte antes de transferir.',
      supportWhatsapp: '', supportEmail: process.env.YOUR_EMAIL || '', honorariosEnabled: false,
    },
  };
}

export function getDb(): DatabaseState {
  const db = databaseContext.getStore();
  if (!db) throw new Error('La operación requiere una transacción PostgreSQL.');
  return db;
}

// The request transaction commits the complete state; failures are never silently ignored.
export function persistDb(): void { getDb(); }

export function appendAuditLog(params: {
  companyId: string | null;
  actorId: string;
  actorName: string;
  actorRole: string;
  operation: string;
  entityType: string;
  entityId: string;
  details: string;
}): AuditLogRecord {
  const db = getDb();
  const entry: AuditLogRecord = {
    id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    companyId: params.companyId,
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    operation: params.operation,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
    createdAtUtc: new Date().toISOString(),
  };
  db.auditLogs.unshift(entry);
  persistDb();
  return entry;
}

// Section 27: Automatic notifications evaluator with deduplication key
export function runAutomaticNotificationsCheck(companyId: string): NotificationRecord[] {
  const db = getDb();
  const cais = db.fiscalAuthorizations.filter((c) => c.companyId === companyId && c.status === 'ACTIVO');

  for (const cai of cais) {
    const vig = evaluateCaiVigencia(cai.limitDate);
    const available = Math.max(0, cai.rangeEnd - cai.lastUsed);
    const qty = evaluateCaiQuantity(available);

    if (vig.level !== 'OK') {
      const dedupKey = `${companyId}:CAI_VIGENCIA:${cai.id}:${vig.level}`;
      if (!db.notifications.some((n) => n.dedupKey === dedupKey)) {
        db.notifications.unshift({
          id: `notif-${crypto.randomUUID().slice(0, 8)}`,
          companyId,
          dedupKey,
          type: 'CAI_VIGENCIA',
          severity: vig.blocksEmission || vig.daysRemaining <= 7 ? 'CRITICAL' : 'WARNING',
          title: `Alerta de Vigencia CAI (${cai.docType}): ${vig.label}`,
          message: `El CAI ${cai.cai} tiene fecha límite ${cai.limitDate}. Estado: ${vig.label}.`,
          channel: 'PANEL_Y_CORREO',
          deliveryStatus: 'ENTREGADO',
          read: false,
          createdAtUtc: new Date().toISOString(),
        });
      }
    }

    if (qty.level !== 'OK') {
      const dedupKey = `${companyId}:CAI_CANTIDAD:${cai.id}:${qty.level}`;
      if (!db.notifications.some((n) => n.dedupKey === dedupKey)) {
        db.notifications.unshift({
          id: `notif-${crypto.randomUUID().slice(0, 8)}`,
          companyId,
          dedupKey,
          type: 'CAI_CANTIDAD',
          severity: qty.blocksEmission || qty.available <= 5 ? 'CRITICAL' : 'WARNING',
          title: `Alerta de Correlativos (${cai.docType}): ${qty.label}`,
          message: `Quedan ${qty.available} correlativos disponibles en el CAI ${cai.cai}.`,
          channel: 'PANEL_Y_CORREO',
          deliveryStatus: 'ENTREGADO',
          read: false,
          createdAtUtc: new Date().toISOString(),
        });
      }
    }
  }

  const sub = db.subscriptions.find((s) => s.companyId === companyId);
  if (sub?.activationPaid) {
    const daysToSub = calculateDaysRemaining(sub.nextPaymentDate);
    if (daysToSub <= 7) {
      const threshold = daysToSub < 0 ? 'VENCIDA' : daysToSub <= 1 ? '1D' : daysToSub <= 3 ? '3D' : '7D';
      const dedupKey = `${companyId}:SUSCRIPCION:${sub.id}:${threshold}`;
      if (!db.notifications.some((n) => n.dedupKey === dedupKey)) {
        db.notifications.unshift({
          id: `notif-${crypto.randomUUID().slice(0, 8)}`,
          companyId,
          dedupKey,
          type: 'SUSCRIPCION',
          severity: daysToSub < 0 ? 'CRITICAL' : 'WARNING',
          title:
            daysToSub < 0
              ? 'Suscripción mensual vencida · Emisión bloqueada'
              : `Suscripción próxima a vencer (${daysToSub} días restantes)`,
          message:
            daysToSub < 0
              ? 'Su mensualidad de L 350.00 se encuentra vencida. Sus documentos históricos están disponibles para consulta y descarga, pero la nueva emisión requiere renovación.'
              : `Su próximo pago mensual de L 350.00 vence el ${sub.nextPaymentDate}.`,
          channel: 'PANEL_Y_CORREO',
          deliveryStatus: 'ENTREGADO',
          read: false,
          createdAtUtc: new Date().toISOString(),
        });
      }
    }
  }

  persistDb();
  return db.notifications.filter((n) => n.companyId === companyId);
}

// Section 19: Server-side Role Permission Enforcement Matrix
export function checkRolePermission(
  role: CompanyRole,
  operation:
    | 'EMITIR'
    | 'CONSULTAR'
    | 'CONFIGURAR_CAI_EMPRESA'
    | 'ANULAR'
    | 'GESTIONAR_USUARIOS_SUSCRIPCION'
    | 'EXPORTAR',
  canExportFlag = true
): boolean {
  switch (operation) {
    case 'EMITIR':
      return role === 'PROPIETARIO' || role === 'FACTURADOR';
    case 'CONSULTAR':
      return role === 'PROPIETARIO' || role === 'FACTURADOR' || role === 'CONSULTA';
    case 'CONFIGURAR_CAI_EMPRESA':
      return role === 'PROPIETARIO';
    case 'ANULAR':
      return role === 'PROPIETARIO';
    case 'GESTIONAR_USUARIOS_SUSCRIPCION':
      return role === 'PROPIETARIO';
    case 'EXPORTAR':
      return role === 'PROPIETARIO' || canExportFlag;
    default:
      return false;
  }
}

// Section 25: Transactional 8-step Document Emission Process
export async function issueOrDraftDocument(params: {
  session: SessionTokenPayload;
  mode: 'BORRADOR' | 'EMITIR';
  idempotencyKey?: string;
  draftId?: string;
  docType: DocumentType;
  currency: 'HNL' | 'USD';
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO';
  paymentCondition: string;
  taxIncluded: boolean;
  generalDiscount: string | number;
  retencionAmount: string | number;
  clientName: string;
  clientRtn: string;
  clientIdDoc?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientWhatsapp?: string;
  clientEmail?: string;
  isFinalConsumer: boolean;
  exoneratedOrder?: string;
  exoneratedRegistry?: string;
  exoneratedSag?: string;
  relatedDocumentId?: string;
  relatedReason?: string;
  templateUsed?: TemplateId;
  paperSize?: PaperSize;
  items: LineItemInput[];
  simulatePdfFailure?: boolean; // For testing Section 12 & 29: "Si falla PDF tras registrar emisión, regenerar el PDF del mismo documento sin consumir otro correlativo"
}): Promise<{ document: DocumentRecord; idempotentReplay: boolean }> {
  return withTransactionLock(async () => {
    const db = getDb();
    const { session, mode } = params;

    // Step 2: Validate session, company membership, permissions, and subscription
    const member = db.companyMembers.find(
      (m) => m.companyId === session.companyId && m.userId === session.userId && m.status === 'ACTIVO'
    );
    if (!member) {
      throw { status: 403, message: 'Acceso denegado: membresía empresarial no activa o revocada.' };
    }
    if (!checkRolePermission(member.role, 'EMITIR')) {
      throw {
        status: 403,
        message: `El rol ${member.role} únicamente tiene permisos de consulta y no puede crear ni emitir documentos.`,
      };
    }

    const company = db.companies.find((c) => c.id === session.companyId);
    if (!company) {
      throw { status: 404, message: 'Empresa no encontrada.' };
    }

    // Check Recibo por Honorarios disabled restriction (Section 9 & 28)
    if (params.docType === 'RECIBO_HONORARIOS' && !db.systemConfig.honorariosEnabled) {
      throw {
        status: 422,
        message:
          'Recibo por honorarios se encuentra deshabilitado hasta confirmar la modalidad permitida para el contribuyente con el SAR.',
      };
    }

    // Check Idempotency Key before any state mutation (Section 8.1, 18, 25)
    const payloadCanonical = JSON.stringify({
      companyId: company.id,
      mode,
      docType: params.docType,
      clientRtn: params.clientRtn,
      clientName: params.clientName,
      taxIncluded: params.taxIncluded,
      generalDiscount: String(params.generalDiscount),
      items: params.items.map((i) => ({
        q: String(i.quantity),
        d: i.description.trim(),
        p: String(i.unitPrice),
        disc: String(i.discount),
        t: i.taxTreatment,
      })),
    });
    const payloadHash = crypto.createHash('sha256').update(payloadCanonical).digest('hex');

    if (mode === 'EMITIR' && params.idempotencyKey) {
      const existingKey = db.idempotencyKeys.find(
        (k) => k.companyId === company.id && k.key === params.idempotencyKey
      );
      if (existingKey) {
        if (existingKey.payloadHash !== payloadHash) {
          throw {
            status: 409,
            message:
              'Conflicto de idempotencia (409): La clave idempotente ya fue utilizada con un contenido de documento diferente.',
          };
        }
        const existingDoc = db.documents.find(
          (d) => d.id === existingKey.documentId && d.companyId === company.id
        );
        if (existingDoc) {
          return { document: existingDoc, idempotentReplay: true };
        }
      }
    }

    // Validate commercial subscription status when emitting (Section 4, 17, 25, 29)
    const sub = db.subscriptions.find((s) => s.companyId === company.id);
    if (mode === 'EMITIR') {
      if (!sub || !sub.activationPaid || sub.status === 'PENDIENTE_ACTIVACION') {
        throw {
          status: 403,
          message:
            'Emisión bloqueada: La cuenta está pendiente de activación comercial (L 4,000.00). Suba su comprobante y espere aprobación del superadministrador BWP.',
        };
      }
      if (sub.status === 'VENCIDA' || sub.status === 'SUSPENDIDA' || sub.status === 'CANCELADA') {
        throw {
          status: 403,
          message: `Emisión bloqueada: Su suscripción se encuentra en estado ${sub.status}. Sus documentos anteriores siguen disponibles para consulta y descarga, pero debe renovar su mensualidad (L 350.00) para emitir nuevos documentos.`,
        };
      }
    }

    // Validate client & exonerated rules (Section 9.1, 9.2, 11)
    const clientName = (params.clientName || '').trim() || (params.isFinalConsumer ? 'CONSUMIDOR FINAL' : '');
    if (!clientName) {
      throw { status: 422, message: 'Debe indicar el nombre o razón social del cliente o seleccionar Consumidor Final.' };
    }
    const clientRtn = (params.clientRtn || '').trim();
    if (clientRtn && !validateHondurasRtn(clientRtn)) {
      throw {
        status: 422,
        message: 'El RTN del cliente debe contener exactamente 14 dígitos numéricos (conservando ceros iniciales).',
      };
    }

    const hasExoneratedLine = params.items.some((i) => i.taxTreatment === 'EXONERADO');
    if (mode === 'EMITIR' && hasExoneratedLine) {
      if (!params.exoneratedOrder?.trim() || !params.exoneratedRegistry?.trim()) {
        throw {
          status: 422,
          message:
            'Las operaciones con tratamiento Exonerado exigen indicar Orden de Compra Exenta y Constancia de Registro de Exonerados.',
        };
      }
    }

    // Step 3: Recalculate taxes on server using ExactDecimal (Section 9.2 & 25)
    let calc: FiscalCalculationResult;
    try {
      calc = calculateFiscalTotals({
        items: params.items,
        taxIncluded: params.taxIncluded,
        generalDiscount: params.generalDiscount,
        retencionAmount: params.retencionAmount,
        currency: params.currency,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en cálculo fiscal.';
      throw { status: 422, message: msg };
    }

    // Validate related invoice if Credit / Debit Note (Section 9 & 15)
    let relatedDoc: DocumentRecord | undefined;
    if (params.docType === 'NOTA_CREDITO' || params.docType === 'NOTA_DEBITO') {
      if (mode === 'EMITIR' && !params.relatedDocumentId) {
        throw {
          status: 422,
          message: 'Las Notas de Crédito y Notas de Débito deben vincularse obligatoriamente a una Factura Fiscal emitida.',
        };
      }
      if (params.relatedDocumentId) {
        relatedDoc = db.documents.find(
          (d) =>
            d.id === params.relatedDocumentId &&
            d.companyId === company.id &&
            d.docType === 'FACTURA' &&
            d.status === 'EMITIDO'
        );
        if (!relatedDoc) {
          throw {
            status: 422,
            message: 'La factura original vinculada no existe, pertenece a otra empresa o se encuentra anulada.',
          };
        }
        if (
          params.docType === 'NOTA_CREDITO' &&
          Number(calc.totalFiscal) > Number(relatedDoc.totals.totalFiscal)
        ) {
          throw {
            status: 422,
            message: `El importe de la Nota de Crédito (L ${calc.totalFiscal}) no puede superar el total de la factura vinculada (L ${relatedDoc.totals.totalFiscal}).`,
          };
        }
      }
    }

    const issueDateLocal = getHondurasDateString();
    const isFiscalDoc =
      params.docType === 'FACTURA' ||
      params.docType === 'NOTA_CREDITO' ||
      params.docType === 'NOTA_DEBITO';

    // Step 4: If EMITIR, lock sequence, verify CAI vigencia & range, and allocate correlative (Section 8.1 & 25)
    // Remember: Borradores y vistas previas NO consumen números!
    let allocatedFiscalNumber = `BORRADOR-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    let allocatedCorrelativeInt: number | undefined;
    let activeCai: FiscalAuthorizationRecord | null = null;

    if (mode === 'EMITIR') {
      if (isFiscalDoc) {
        activeCai =
          db.fiscalAuthorizations.find(
            (c) =>
              c.companyId === company.id &&
              c.docType === params.docType &&
              (c.status === 'ACTIVO' || c.status === 'PROXIMO_A_VENCER')
          ) || null;

        if (!activeCai) {
          throw {
            status: 422,
            message: `No existe una autorización CAI activa para el tipo documental ${params.docType}. Configure y active su CAI en el módulo CAI y correlativos.`,
          };
        }

        // Check fecha límite inclusive in America/Tegucigalpa (Section 8.1)
        const vig = evaluateCaiVigencia(activeCai.limitDate);
        if (vig.blocksEmission || issueDateLocal > activeCai.limitDate) {
          activeCai.status = 'VENCIDO';
          persistDb();
          throw {
            status: 422,
            message: `Emisión bloqueada: El CAI ${activeCai.cai} venció el ${activeCai.limitDate} (Zona horaria America/Tegucigalpa).`,
          };
        }

        const nextCorrelative = Math.max(activeCai.rangeStart, activeCai.lastUsed + 1);
        if (nextCorrelative > activeCai.rangeEnd) {
          activeCai.status = 'AGOTADO';
          persistDb();
          throw {
            status: 422,
            message: `Emisión bloqueada: El rango autorizado (${activeCai.rangeStart} al ${activeCai.rangeEnd}) del CAI ${activeCai.cai} se encuentra agotado (0 disponibles).`,
          };
        }

        const candidateFiscalNumber = formatFiscalNumber(
          activeCai.establishment,
          activeCai.emissionPoint,
          activeCai.docTypeCode,
          nextCorrelative
        );

        // Enforce unique constraint per company and complete fiscal number (Section 8.1 & 23)
        const duplicateExists = db.documents.some(
          (d) =>
            d.companyId === company.id &&
            d.docType === params.docType &&
            d.fiscalNumber === candidateFiscalNumber
        );
        if (duplicateExists) {
          throw {
            status: 409,
            message: `Restricción única violada: El número fiscal ${candidateFiscalNumber} ya fue registrado en esta empresa y no puede duplicarse ni reutilizarse.`,
          };
        }

        // Commit sequence increment inside transaction lock
        activeCai.lastUsed = nextCorrelative;
        if (activeCai.lastUsed >= activeCai.rangeEnd) {
          activeCai.status = 'AGOTADO';
        }
        allocatedCorrelativeInt = nextCorrelative;
        allocatedFiscalNumber = candidateFiscalNumber;
      } else {
        // Non-fiscal internal sequence for RECIBO or COTIZACION (Section 9)
        if (!db.internalSequences[company.id]) {
          db.internalSequences[company.id] = { RECIBO: 0, COTIZACION: 0 };
        }
        const seqKey = params.docType === 'RECIBO' ? 'RECIBO' : 'COTIZACION';
        const nextInternal = (db.internalSequences[company.id][seqKey] || 0) + 1;
        db.internalSequences[company.id][seqKey] = nextInternal;
        allocatedCorrelativeInt = nextInternal;
        allocatedFiscalNumber = String(nextInternal).padStart(8, '0');
      }
    }

    const templateUsed = params.templateUsed || company.defaultTemplate || 'CORPORATIVA';
    const paperSize = params.paperSize || company.paperSize || 'LETTER';
    const docId = params.draftId || `doc-${crypto.randomUUID().slice(0, 8)}`;

    const docTypeLabel =
      params.docType === 'FACTURA'
        ? 'Factura Fiscal'
        : params.docType === 'RECIBO'
          ? 'Recibo de Pago (No Fiscal)'
          : params.docType === 'COTIZACION'
            ? 'Cotización Comercial'
            : params.docType === 'NOTA_CREDITO'
              ? 'Nota de Crédito Fiscal'
              : 'Nota de Débito Fiscal';

    // Step 5: Build immutable snapshot of company, CAI, client, template, and totals (Section 7 & 23)
    const snapshot: PdfDocumentPayload = {
      id: docId,
      docType: params.docType,
      docTypeLabel,
      fiscalNumber: allocatedFiscalNumber,
      status: mode === 'EMITIR' ? 'EMITIDO' : 'BORRADOR',
      issueDateLocal,
      currency: params.currency,
      paymentMethod: params.paymentMethod,
      paymentCondition: params.paymentCondition || company.paymentTerms || 'Contado',
      templateUsed,
      templateVersion: company.templateVersion,
      paperSize,
      companySnapshot: {
        legalName: company.legalName,
        commercialName: company.commercialName,
        rtn: company.rtn,
        addressMatriz: company.addressMatriz,
        addressEstablecimiento: company.addressEstablecimiento,
        department: company.department,
        municipality: company.municipality,
        phone: company.phone,
        whatsapp: company.whatsapp,
        email: company.email,
        website: company.website,
        economicActivity: company.economicActivity,
        representative: company.representative,
        modality: company.modality,
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
        footerMessage: company.footerMessage,
        bankInfo: company.bankInfo,
      },
      caiSnapshot: activeCai
        ? {
            cai: activeCai.cai,
            rangeStartFormatted: formatFiscalNumber(
              activeCai.establishment,
              activeCai.emissionPoint,
              activeCai.docTypeCode,
              activeCai.rangeStart
            ),
            rangeEndFormatted: formatFiscalNumber(
              activeCai.establishment,
              activeCai.emissionPoint,
              activeCai.docTypeCode,
              activeCai.rangeEnd
            ),
            authDate: activeCai.authDate,
            limitDate: activeCai.limitDate,
          }
        : null,
      clientSnapshot: {
        name: clientName,
        rtn: clientRtn,
        idDoc: params.clientIdDoc || '',
        address: params.clientAddress || 'Ciudad',
        phone: params.clientPhone || params.clientWhatsapp || '',
        email: params.clientEmail || '',
        isFinalConsumer: params.isFinalConsumer,
        exoneratedOrder: params.exoneratedOrder || '',
        exoneratedRegistry: params.exoneratedRegistry || '',
        exoneratedSag: params.exoneratedSag || '',
      },
      relatedDocSnapshot: relatedDoc
        ? {
            fiscalNumber: relatedDoc.fiscalNumber,
            cai: relatedDoc.caiCode || 'N/A',
            issueDate: relatedDoc.issueDateLocal,
            reason: params.relatedReason || 'Ajuste vinculado a factura fiscal',
          }
        : null,
      items: calc.items,
      totals: {
        subtotalGross: calc.subtotalGross,
        totalDiscounts: calc.totalDiscounts,
        baseExenta: calc.baseExenta,
        baseExonerada: calc.baseExonerada,
        baseAlicuotaCero: calc.baseAlicuotaCero,
        baseGravada15: calc.baseGravada15,
        baseGravada18: calc.baseGravada18,
        isv15: calc.isv15,
        isv18: calc.isv18,
        totalIsv: calc.totalIsv,
        totalFiscal: calc.totalFiscal,
        retencionAmount: calc.retencionAmount,
        netPayable: calc.netPayable,
        totalInWords: calc.totalInWords,
      },
    };

    const nowUtc = new Date().toISOString();

    const newDoc: DocumentRecord = {
      id: docId,
      companyId: company.id,
      docType: params.docType,
      fiscalNumber: allocatedFiscalNumber,
      correlativeInt: allocatedCorrelativeInt,
      caiId: activeCai?.id || null,
      caiCode: activeCai?.cai || null,
      status: mode === 'EMITIR' ? 'EMITIDO' : 'BORRADOR',
      issueDateLocal,
      createdAtUtc: nowUtc,
      issuedAtUtc: mode === 'EMITIR' ? nowUtc : undefined,
      currency: params.currency,
      paymentMethod: params.paymentMethod,
      paymentCondition: params.paymentCondition || 'Contado',
      taxIncluded: params.taxIncluded,
      generalDiscount: calc.generalDiscount,
      retencionAmount: calc.retencionAmount,
      clientName,
      clientRtn,
      clientIdDoc: params.clientIdDoc || '',
      clientAddress: params.clientAddress || '',
      clientPhone: params.clientPhone || '',
      clientWhatsapp: params.clientWhatsapp || '',
      clientEmail: params.clientEmail || '',
      isFinalConsumer: params.isFinalConsumer,
      exoneratedOrder: params.exoneratedOrder || '',
      exoneratedRegistry: params.exoneratedRegistry || '',
      exoneratedSag: params.exoneratedSag || '',
      relatedDocumentId: relatedDoc?.id || null,
      relatedFiscalNumber: relatedDoc?.fiscalNumber || null,
      relatedReason: params.relatedReason || '',
      templateUsed,
      templateVersion: company.templateVersion,
      paperSize,
      items: calc.items,
      totals: {
        subtotalGross: calc.subtotalGross,
        lineDiscountsTotal: calc.lineDiscountsTotal,
        generalDiscount: calc.generalDiscount,
        totalDiscounts: calc.totalDiscounts,
        baseExenta: calc.baseExenta,
        baseExonerada: calc.baseExonerada,
        baseAlicuotaCero: calc.baseAlicuotaCero,
        baseGravada15: calc.baseGravada15,
        baseGravada18: calc.baseGravada18,
        isv15: calc.isv15,
        isv18: calc.isv18,
        totalIsv: calc.totalIsv,
        totalFiscal: calc.totalFiscal,
        retencionAmount: calc.retencionAmount,
        netPayable: calc.netPayable,
        totalInWords: calc.totalInWords,
      },
      snapshot,
      pdfStatus: 'PENDIENTE',
      pdfVersion: 1,
      cancellation: null,
    };

    // Replace existing draft if updating a draft, otherwise insert at top
    const existingIdx = params.draftId
      ? db.documents.findIndex(
          (d) => d.id === params.draftId && d.companyId === company.id && d.status === 'BORRADOR'
        )
      : -1;
    if (existingIdx >= 0) {
      db.documents[existingIdx] = newDoc;
    } else {
      db.documents.unshift(newDoc);
    }

    // Save idempotency key and accounting event inside transaction (Step 5 & 6)
    if (mode === 'EMITIR') {
      if (params.idempotencyKey) {
        db.idempotencyKeys.push({
          key: params.idempotencyKey,
          companyId: company.id,
          payloadHash,
          documentId: newDoc.id,
          createdAtUtc: nowUtc,
        });
      }

      if (isFiscalDoc) {
        db.integrationEvents.unshift({
          id: `iev-${crypto.randomUUID().slice(0, 8)}`,
          companyId: company.id,
          documentId: newDoc.id,
          fiscalNumber: newDoc.fiscalNumber,
          eventType:
            params.docType === 'FACTURA' ? 'DOCUMENTO_EMITIDO' : 'NOTA_AJUSTE',
          payloadSummary: `${docTypeLabel} ${newDoc.fiscalNumber} · Base 15%: L ${calc.baseGravada15} · ISV: L ${calc.totalIsv} · Total: L ${calc.totalFiscal}`,
          externalReference: `ASIENTO-${issueDateLocal}-${newDoc.fiscalNumber.slice(-4)}`,
          attempts: 1,
          status: 'CONCILIADO',
          updatedAtUtc: nowUtc,
        });
      }

      db.auditLogs.unshift({
        id: `aud-${crypto.randomUUID().slice(0, 8)}`,
        companyId: company.id,
        actorId: session.userId,
        actorName: session.name,
        actorRole: member.role,
        operation: 'DOCUMENTO_EMITIDO',
        entityType: 'document',
        entityId: newDoc.id,
        details: `Emisión de ${docTypeLabel} No. ${newDoc.fiscalNumber} a ${clientName} por ${params.currency} ${calc.totalFiscal}.`,
        createdAtUtc: nowUtc,
      });
    }

    // Step 7: Generate PDF and store hash AFTER transaction commit (if PDF fails, correlative is preserved and PDF can be regenerated without consuming another number! Section 12 & 25)
    try {
      if (false && params.simulatePdfFailure) {
        throw new Error('Fallo simulado de motor PDF para prueba de regeneración sin consumo de correlativo.');
      }
      const pdfResult = generateServerPdf(newDoc.snapshot);
      newDoc.pdfStatus = 'GENERADO';
      newDoc.pdfHash = pdfResult.sha256Hash;
      newDoc.pdfFilename = pdfResult.filename;
    } catch {
      newDoc.pdfStatus = 'ERROR';
    }

    runAutomaticNotificationsCheck(company.id);
    persistDb();

    return { document: newDoc, idempotentReplay: false };
  });
}

export { validateCaiFormat, validateHondurasRtn };
