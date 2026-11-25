'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Bell,
  Building2,
  Check,
  Copy,
  CreditCard,
  Download,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Palette,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Share2,
  ShieldAlert,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  calculateFiscalTotals,
  DocumentType,
  formatCurrency,
  formatHondurasDateDisplay,
  LineItemInput,
  TaxTreatment,
} from '@/lib/fiscal-engine';
import { PaperSize, PdfDocumentPayload, TemplateId } from '@/lib/pdf-generator';
import InvoiceTemplatePreview from './InvoiceTemplatePreview';

export type EnterpriseModule =
  | 'INICIO'
  | 'CREAR_DOCUMENTO'
  | 'DOCUMENTOS_EMITIDOS'
  | 'CAI_CORRELATIVOS'
  | 'MI_EMPRESA'
  | 'PLANTILLAS'
  | 'MI_SUSCRIPCION';

interface EnterprisePortalProps {
  token: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    role: 'PROPIETARIO' | 'FACTURADOR' | 'CONSULTA';
    isSuperAdmin: boolean;
  };
  initialVerificationToken?: string;
  onSwitchAccount: (email: string) => void;
  onLogout: () => void;
}

export default function EnterprisePortal({
  token,
  currentUser,
  initialVerificationToken,
  onSwitchAccount,
  onLogout,
}: EnterprisePortalProps) {
  const [activeModule, setActiveModule] = useState<EnterpriseModule>('INICIO');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'OK' | 'ERR'; text: string } | null>(null);
  const [emailVerifiedState, setEmailVerifiedState] = useState(currentUser.emailVerified);
  const [pendingVerifyToken, setPendingVerifyToken] = useState(initialVerificationToken || '');

  // Loaded State from Server
  const [company, setCompany] = useState<any>(null);
  const [fiscalStatus, setFiscalStatus] = useState<any>(null);
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docSummary, setDocSummary] = useState({
    filteredFiscalTotal: '0.00',
    filteredNonFiscalTotal: '0.00',
  });
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [integrationSetting, setIntegrationSetting] = useState<any>(null);
  const [integrationEvents, setIntegrationEvents] = useState<any[]>([]);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

  // Filters for Documentos Emitidos (Section 14)
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDocType, setFilterDocType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSortBy, setFilterSortBy] = useState('date_desc');

  // Crear Documento Form State (Section 9)
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [docType, setDocType] = useState<DocumentType>('FACTURA');
  const [currency, setCurrency] = useState<'HNL' | 'USD'>('HNL');
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO'>('TRANSFERENCIA');
  const [paymentCondition, setPaymentCondition] = useState('Contado');
  const [taxIncluded, setTaxIncluded] = useState(false);
  const [generalDiscount, setGeneralDiscount] = useState('0');
  const [retencionAmount, setRetencionAmount] = useState('0');
  const [isFinalConsumer, setIsFinalConsumer] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientRtn, setClientRtn] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientWhatsapp, setClientWhatsapp] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [exoneratedOrder, setExoneratedOrder] = useState('');
  const [exoneratedRegistry, setExoneratedRegistry] = useState('');
  const [exoneratedSag, setExoneratedSag] = useState('');
  const [relatedDocumentId, setRelatedDocumentId] = useState('');
  const [relatedReason, setRelatedReason] = useState('');
  const [simulatePdfFailure, setSimulatePdfFailure] = useState(false);
  const [items, setItems] = useState<LineItemInput[]>([
    {
      id: 'line-1',
      quantity: '1',
      description: '',
      unitPrice: '0.00',
      discount: '0',
      taxTreatment: 'ISV_15',
    },
  ]);

  // Emission Processing & Idempotency State (Section 9.3 & 25)
  const [idempotencyKey, setIdempotencyKey] = useState(() => `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [emitting, setEmitting] = useState(false);
  const [confirmEmitModal, setConfirmEmitModal] = useState(false);
  const [emittedSuccessDoc, setEmittedSuccessDoc] = useState<any>(null);

  // Modal States for Document Actions (Preview, Void/Anulación, Share/WhatsApp, Email)
  const [selectedDocModal, setSelectedDocModal] = useState<any>(null);
  const [voidDocModal, setVoidDocModal] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');
  const [shareDocModal, setShareDocModal] = useState<any>(null);
  const [shareResult, setShareResult] = useState<any>(null);
  const [sharePhone, setSharePhone] = useState('');
  const [emailDocModal, setEmailDocModal] = useState<any>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailConfirmedCheck, setEmailConfirmedCheck] = useState(false);

  // New CAI Registration State (Section 8)
  const [newCaiDocType, setNewCaiDocType] = useState<DocumentType>('FACTURA');
  const [newCaiCode, setNewCaiCode] = useState('');
  const [newCaiEst, setNewCaiEst] = useState('000');
  const [newCaiPt, setNewCaiPt] = useState('001');
  const [newCaiRangeStart, setNewCaiRangeStart] = useState('201');
  const [newCaiRangeEnd, setNewCaiRangeEnd] = useState('500');
  const [newCaiMigratedLast, setNewCaiMigratedLast] = useState('');
  const [newCaiAuthDate, setNewCaiAuthDate] = useState('');
  const [newCaiLimitDate, setNewCaiLimitDate] = useState('');
  const [newCaiPdfName, setNewCaiPdfName] = useState('Autorizacion_SAR_Nuevo_Rango.pdf');

  // New Member Invite State (Section 19)
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'PROPIETARIO' | 'FACTURADOR' | 'CONSULTA'>('FACTURADOR');
  const [inviteCanExport, setInviteCanExport] = useState(true);

  // New Payment Receipt Upload State (Section 17)
  const [payType, setPayType] = useState<'ACTIVACION_UNICA' | 'MENSUALIDAD'>('MENSUALIDAD');
  const [payBankName, setPayBankName] = useState('BAC Credomatic Honduras');
  const [payReference, setPayReference] = useState('');
  const [payFilename, setPayFilename] = useState('Comprobante_Transferencia_BWP.pdf');
  const [receiptDataUrl,setReceiptDataUrl] = useState('');
  const [supportPdfDataUrl,setSupportPdfDataUrl] = useState('');
  function readAttachment(file: File | undefined, setter: (value: string)=>void) {
    setter(''); if(!file) return; if(file.size>2*1024*1024) {setFeedback({type:'ERR',text:'El archivo debe ser menor de 2 MB.'});return;}
    const reader=new FileReader(); reader.onload=()=>setter(String(reader.result));reader.readAsDataURL(file);
  }
  const [payNotes, setPayNotes] = useState('');

  const loadAllPortalData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const q = new URLSearchParams({
        search: filterSearch,
        docType: filterDocType,
        status: filterStatus,
        paymentMethod: filterPaymentMethod,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        sortBy: filterSortBy,
      });

      const [compRes, statusRes, authRes, docsRes, subRes] = await Promise.all([
        fetch('/api/company', { headers }),
        fetch('/api/fiscal/status', { headers }),
        fetch('/api/fiscal/authorizations', { headers }),
        fetch(`/api/documents?${q.toString()}`, { headers }),
        fetch('/api/subscriptions', { headers }),
      ]);

      if (compRes.ok) {
        const compJson = await compRes.json();
        setCompany(compJson.company);
        setMembers(compJson.members || []);
        setNotifications(compJson.notifications || []);
        setAuditLogs(compJson.auditLogs || []);
        setIntegrationSetting(compJson.integrationSetting || null);
        setIntegrationEvents(compJson.integrationEvents || []);
      }
      if (statusRes.ok) {
        setFiscalStatus(await statusRes.json());
      }
      if (authRes.ok) {
        const authJson = await authRes.json();
        setAuthorizations(authJson.authorizations || []);
      }
      if (docsRes.ok) {
        const docsJson = await docsRes.json();
        setDocuments(docsJson.documents || []);
        setDocSummary(docsJson.summary || { filteredFiscalTotal: '0.00', filteredNonFiscalTotal: '0.00' });
        setClientSuggestions(docsJson.clientSuggestions || []);
      }
      if (subRes.ok) {
        const subJson = await subRes.json();
        setSubscriptionData(subJson);
        if (subJson.subscription && !subJson.subscription.activationPaid) {
          setPayType('ACTIVACION_UNICA');
        }
      }
    } catch {
      setFeedback({ type: 'ERR', text: 'Error al sincronizar datos con el servidor.' });
    } finally {
      setLoading(false);
    }
  }, [
    token,
    filterSearch,
    filterDocType,
    filterStatus,
    filterPaymentMethod,
    filterDateFrom,
    filterDateTo,
    filterSortBy,
  ]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadAllPortalData();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadAllPortalData]);

  // Live client-side preview calculation matching server ExactDecimal engine
  const liveCalculation = useMemo(() => {
    try {
      return calculateFiscalTotals({
        items,
        taxIncluded,
        generalDiscount,
        retencionAmount,
        currency,
      });
    } catch {
      return null;
    }
  }, [items, taxIncluded, generalDiscount, retencionAmount, currency]);

  const liveDraftPreviewPayload: PdfDocumentPayload | null = useMemo(() => {
    if (!company || !liveCalculation) return null;
    const activeCaiForType = authorizations.find(
      (a) => a.docType === docType && (a.status === 'ACTIVO' || a.status === 'PROXIMO_A_VENCER')
    );
    const docTypeLabel =
      docType === 'FACTURA'
        ? 'Factura Fiscal'
        : docType === 'RECIBO'
          ? 'Recibo de Pago (No Fiscal)'
          : docType === 'COTIZACION'
            ? 'Cotización Comercial'
            : docType === 'NOTA_CREDITO'
              ? 'Nota de Crédito Fiscal'
              : 'Nota de Débito Fiscal';

    return {
      id: draftId || 'preview-draft',
      docType,
      docTypeLabel,
      fiscalNumber:
        activeCaiForType && (docType === 'FACTURA' || docType === 'NOTA_CREDITO' || docType === 'NOTA_DEBITO')
          ? `${activeCaiForType.nextFiscalNumber} (VISTA PREVIA)`
          : 'BORRADOR · SIN CORRELATIVO ASIGNADO',
      status: 'BORRADOR',
      issueDateLocal: fiscalStatus?.todayLocal || '2026-11-24',
      currency,
      paymentMethod,
      paymentCondition,
      templateUsed: company.defaultTemplate || 'CORPORATIVA',
      templateVersion: company.templateVersion || 'v1.0-SAR-2026',
      paperSize: company.paperSize || 'LETTER',
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
      caiSnapshot:
        activeCaiForType && (docType === 'FACTURA' || docType === 'NOTA_CREDITO' || docType === 'NOTA_DEBITO')
          ? {
              cai: activeCaiForType.cai,
              rangeStartFormatted: activeCaiForType.rangeStartFormatted,
              rangeEndFormatted: activeCaiForType.rangeEndFormatted,
              authDate: activeCaiForType.authDate,
              limitDate: activeCaiForType.limitDate,
            }
          : null,
      clientSnapshot: {
        name: isFinalConsumer ? 'CONSUMIDOR FINAL' : clientName || 'Cliente',
        rtn: isFinalConsumer ? '' : clientRtn,
        address: clientAddress || 'Ciudad',
        phone: clientWhatsapp,
        email: clientEmail,
        isFinalConsumer,
        exoneratedOrder,
        exoneratedRegistry,
        exoneratedSag,
      },
      items: liveCalculation.items,
      totals: {
        subtotalGross: liveCalculation.subtotalGross,
        totalDiscounts: liveCalculation.totalDiscounts,
        baseExenta: liveCalculation.baseExenta,
        baseExonerada: liveCalculation.baseExonerada,
        baseAlicuotaCero: liveCalculation.baseAlicuotaCero,
        baseGravada15: liveCalculation.baseGravada15,
        baseGravada18: liveCalculation.baseGravada18,
        isv15: liveCalculation.isv15,
        isv18: liveCalculation.isv18,
        totalIsv: liveCalculation.totalIsv,
        totalFiscal: liveCalculation.totalFiscal,
        retencionAmount: liveCalculation.retencionAmount,
        netPayable: liveCalculation.netPayable,
        totalInWords: liveCalculation.totalInWords,
      },
    };
  }, [
    company,
    liveCalculation,
    authorizations,
    docType,
    draftId,
    fiscalStatus,
    currency,
    paymentMethod,
    paymentCondition,
    isFinalConsumer,
    clientName,
    clientRtn,
    clientAddress,
    clientWhatsapp,
    clientEmail,
    exoneratedOrder,
    exoneratedRegistry,
    exoneratedSag,
  ]);

  async function handleVerifyEmailSingleUse() {
    if (!pendingVerifyToken) return;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY_EMAIL',
          verificationToken: pendingVerifyToken,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setEmailVerifiedState(true);
        setPendingVerifyToken('');
        setFeedback({
          type: 'OK',
          text: 'Correo electrónico verificado correctamente mediante enlace de un solo uso.',
        });
      } else {
        setFeedback({ type: 'ERR', text: json.error || 'Error al verificar correo.' });
      }
    } catch {
      setFeedback({ type: 'ERR', text: 'Error de red al verificar correo.' });
    }
  }

  async function handleSaveDraft() {
    setEmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/documents/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          draftId,
          docType,
          currency,
          paymentMethod,
          paymentCondition,
          taxIncluded,
          generalDiscount,
          retencionAmount,
          clientName: isFinalConsumer ? 'CONSUMIDOR FINAL' : clientName,
          clientRtn: isFinalConsumer ? '' : clientRtn,
          clientAddress,
          clientWhatsapp,
          clientEmail,
          isFinalConsumer,
          exoneratedOrder,
          exoneratedRegistry,
          exoneratedSag,
          relatedDocumentId,
          relatedReason,
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'ERR', text: json.error || 'Error al guardar borrador.' });
      } else {
        setDraftId(json.document.id);
        setFeedback({ type: 'OK', text: json.message });
        await loadAllPortalData();
      }
    } finally {
      setEmitting(false);
    }
  }

  async function handleIssueDocument() {
    if (emitting) return; // Button locked while processing (Section 9.3)
    setEmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/documents/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          idempotencyKey,
          draftId,
          docType,
          currency,
          paymentMethod,
          paymentCondition,
          taxIncluded,
          generalDiscount,
          retencionAmount,
          clientName: isFinalConsumer ? 'CONSUMIDOR FINAL' : clientName,
          clientRtn: isFinalConsumer ? '' : clientRtn,
          clientAddress,
          clientWhatsapp,
          clientEmail,
          isFinalConsumer,
          exoneratedOrder,
          exoneratedRegistry,
          exoneratedSag,
          relatedDocumentId,
          relatedReason,
          items,
          simulatePdfFailure,
        }),
      });
      const json = await res.json();
      setConfirmEmitModal(false);
      if (!res.ok) {
        // Preserve form state on concrete error (Section 9.3)
        setFeedback({ type: 'ERR', text: json.error || 'Error al emitir documento.' });
      } else {
        setEmittedSuccessDoc(json.document);
        setFeedback({ type: 'OK', text: json.message });
        await loadAllPortalData();
      }
    } finally {
      setEmitting(false);
    }
  }

  function resetNewDocumentForm() {
    setDraftId(undefined);
    setEmittedSuccessDoc(null);
    setIdempotencyKey(`idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setSimulatePdfFailure(false);
    setItems([
      {
        id: `line-${Date.now()}`,
        quantity: '1',
        description: 'Servicio profesional de consultoría técnica',
        unitPrice: '0.00',
        discount: '0',
        taxTreatment: 'ISV_15',
      },
    ]);
  }

  // Duplicate concepts from an existing document as a new draft without reusing correlative (Section 14)
  function handleDuplicateAsNewDraft(doc: any) {
    setDraftId(undefined);
    setEmittedSuccessDoc(null);
    setIdempotencyKey(`idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setDocType(doc.docType === 'RECIBO_HONORARIOS' ? 'FACTURA' : doc.docType);
    setCurrency(doc.currency || 'HNL');
    setPaymentMethod(doc.paymentMethod || 'TRANSFERENCIA');
    setPaymentCondition(doc.paymentCondition || 'Contado');
    setTaxIncluded(Boolean(doc.taxIncluded));
    setGeneralDiscount(doc.generalDiscount || '0');
    setRetencionAmount(doc.retencionAmount || '0');
    setIsFinalConsumer(Boolean(doc.isFinalConsumer));
    setClientName(doc.clientName || '');
    setClientRtn(doc.clientRtn || '');
    setClientAddress(doc.clientAddress || '');
    setClientWhatsapp(doc.clientWhatsapp || '');
    setClientEmail(doc.clientEmail || '');
    setItems(
      (doc.items || []).map((it: any, idx: number) => ({
        id: `dup-${idx}-${Date.now()}`,
        quantity: it.quantity,
        description: it.description,
        unitPrice: it.unitPrice,
        discount: it.discount,
        taxTreatment: it.taxTreatment,
      }))
    );
    setActiveModule('CREAR_DOCUMENTO');
    setFeedback({
      type: 'OK',
      text: `Conceptos de ${doc.fiscalNumber} cargados como nuevo borrador independiente (sin reutilizar numeración).`,
    });
  }

  async function handleDownloadPdf(docId: string, filename?: string) {
    try {
      const res = await fetch(`/api/documents/${docId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'ERR', text: err.error || 'No se pudo descargar el PDF.' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `DOCUMENTO_${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFeedback({ type: 'ERR', text: 'Error al descargar el archivo PDF.' });
    }
  }

  async function handlePrintPdf(docId: string) {
    try {
      const res = await fetch(`/api/documents/${docId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setFeedback({ type: 'ERR', text: 'No se pudo preparar el PDF para impresión.' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };
    } catch {
      setFeedback({ type: 'ERR', text: 'Error al abrir diálogo de impresión.' });
    }
  }

  async function handleRegeneratePdf(docId: string) {
    try {
      const res = await fetch(`/api/documents/${docId}/pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'ERR', text: json.error || 'Error al regenerar PDF.' });
      } else {
        setFeedback({ type: 'OK', text: json.message });
        if (emittedSuccessDoc && emittedSuccessDoc.id === docId) {
          setEmittedSuccessDoc(json.document);
        }
        await loadAllPortalData();
      }
    } catch {
      setFeedback({ type: 'ERR', text: 'Error al regenerar PDF en el servidor.' });
    }
  }

  // Section 13: Option 1 Web Share API navigator.canShare({files}) & Option 2 wa.me with private revocable link
  async function handleOpenShareModal(doc: any) {
    setShareDocModal(doc);
    setSharePhone(doc.clientWhatsapp || doc.clientPhone || '50499887766');
    setShareResult(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'CREATE',
          phone: doc.clientWhatsapp || doc.clientPhone || '50499887766',
          hoursValid: 72,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShareResult(json);
      } else {
        setFeedback({ type: 'ERR', text: json.error || 'Error al generar enlace privado.' });
      }
    } catch {
      setFeedback({ type: 'ERR', text: 'Error al preparar enlace de WhatsApp.' });
    }
  }

  async function handleWebShareNativeFile(doc: any) {
    try {
      const res = await fetch(`/api/documents/${doc.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const file = new File([blob], doc.pdfFilename || `FACTURA_${doc.fiscalNumber}.pdf`, {
        type: 'application/pdf',
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${doc.docType} ${doc.fiscalNumber}`,
          text: shareResult?.whatsappMessage || `Documento ${doc.fiscalNumber}`,
          files: [file],
        });
      } else {
        setFeedback({
          type: 'ERR',
          text: 'Su navegador de escritorio no soporta adjuntar archivos vía Web Share API. Utilice el enlace wa.me o descargue el PDF para adjuntarlo manualmente.',
        });
      }
    } catch {
      // User cancelled share sheet
    }
  }

  async function handleRevokeShareLink(docId: string, linkId: string) {
    const res = await fetch(`/api/documents/${docId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'REVOKE', linkId }),
    });
    const json = await res.json();
    if (res.ok && shareResult) {
      setShareResult({ ...shareResult, shareLinks: json.shareLinks });
      setFeedback({ type: 'OK', text: 'Enlace privado revocado inmediatamente.' });
    }
  }

  async function handleSendEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailDocModal) return;
    const res = await fetch(`/api/documents/${emailDocModal.id}/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: emailRecipient,
        confirmedRecipient: emailConfirmedCheck,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'ERR', text: json.error || 'Error al enviar correo.' });
    } else {
      setFeedback({ type: 'OK', text: json.message });
      setEmailDocModal(null);
      await loadAllPortalData();
    }
  }

  async function handleVoidDocumentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!voidDocModal) return;
    const res = await fetch(`/api/documents/${voidDocModal.id}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: voidReason }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'ERR', text: json.error || 'No se pudo anular el documento.' });
    } else {
      setFeedback({ type: 'OK', text: json.message });
      setVoidDocModal(null);
      setVoidReason('');
      await loadAllPortalData();
    }
  }

  async function handleExportReport(reportType: string, format: 'CSV' | 'TXT' = 'CSV') {
    const q = new URLSearchParams({
      reportType,
      format,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
    });
    const res = await fetch(`/api/reports/export?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setFeedback({ type: 'ERR', text: err.error || 'Error al exportar reporte.' });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REPORTE_${reportType}_${company?.rtn || 'BWP'}.${format === 'TXT' ? 'txt' : 'csv'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleRegisterCai(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/fiscal/authorizations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        docType: newCaiDocType,
        cai: newCaiCode,
        establishment: newCaiEst,
        emissionPoint: newCaiPt,
        rangeStart: Number(newCaiRangeStart),
        rangeEnd: Number(newCaiRangeEnd),
        lastUsed: newCaiMigratedLast ? Number(newCaiMigratedLast) : undefined,
        authDate: newCaiAuthDate,
        limitDate: newCaiLimitDate,
        supportPdfName: newCaiPdfName,
        supportPdfDataUrl,
        activateNow: true,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'ERR', text: json.error || 'Error al registrar CAI.' });
    } else {
      setFeedback({
        type: 'OK',
        text: `Autorización CAI ${json.authorization.cai} registrada y activada correctamente.`,
      });
      await loadAllPortalData();
    }
  }

  async function handleChangeCaiStatus(caiId: string, status: string) {
    const res = await fetch('/api/fiscal/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ caiId, status }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'ERR', text: json.error || 'Error al cambiar estado del CAI.' });
    } else {
      setFeedback({ type: 'OK', text: `Estado del CAI actualizado a ${status}.` });
      await loadAllPortalData();
    }
  }

  async function handleSaveCompanyProfile(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/company', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'UPDATE_COMPANY',
        ...company,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'ERR', text: json.error || 'Error al actualizar empresa.' });
    } else {
      setCompany(json.company);
      setFeedback({
        type: 'OK',
        text: 'Datos fiscales y plantilla predeterminada actualizados. (Los documentos históricos emitidos conservan su instantánea original).',
      });
      await loadAllPortalData();
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/company', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'INVITE_MEMBER',
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        canExport: inviteCanExport,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'ERR', text: json.error || 'Error al invitar usuario.' });
    } else {
      setMembers(json.members);
      setInviteName('');
      setInviteEmail('');
      setFeedback({ type: 'OK', text: 'Miembro invitado y permisos asignados en servidor.' });
    }
  }

  async function handleRevokeMember(memberId: string) {
    const res = await fetch('/api/company', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'REVOKE_MEMBER', memberId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'ERR', text: json.error || 'Error al revocar miembro.' });
    } else {
      setMembers(json.members);
      setFeedback({ type: 'OK', text: 'Acceso de miembro revocado y auditado.' });
    }
  }

  async function handleSubmitPaymentReceipt(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/subscriptions/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        paymentType: payType,
        bankName: payBankName,
        bankReference: payReference,
        receiptFilename: payFilename,
        receiptDataUrl,
        notes: payNotes,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'ERR', text: json.error || 'Error al enviar comprobante.' });
    } else {
      setFeedback({ type: 'OK', text: json.message });
      setPayReference('');
      setPayNotes('');
      await loadAllPortalData();
    }
  }

  // Strictly the 7 menu items mandated in Section 5 (Page 5)
  const menuItems: Array<{ id: EnterpriseModule; label: string; icon: React.ReactNode }> = [
    { id: 'INICIO', label: 'Inicio', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'CREAR_DOCUMENTO', label: 'Crear documento', icon: <FilePlus2 className="w-4 h-4" /> },
    { id: 'DOCUMENTOS_EMITIDOS', label: 'Documentos emitidos', icon: <FileText className="w-4 h-4" /> },
    { id: 'CAI_CORRELATIVOS', label: 'CAI y correlativos', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'MI_EMPRESA', label: 'Mi empresa', icon: <Building2 className="w-4 h-4" /> },
    { id: 'PLANTILLAS', label: 'Plantillas', icon: <Palette className="w-4 h-4" /> },
    { id: 'MI_SUSCRIPCION', label: 'Mi suscripción', icon: <CreditCard className="w-4 h-4" /> },
  ];

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#141414] flex flex-col lg:flex-row">
      {/* Sidebar Navigation (Section 5 & 20: Menú lateral en escritorio y navegación compacta en móvil) */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-neutral-200 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
            <div>
              <div className="font-display font-bold text-lg tracking-tight text-[#7A1C24]">
                BWP NEXO
              </div>
              <div className="text-xs text-neutral-500 truncate max-w-[190px]">
                {company?.commercialName || 'Portal Empresarial'}
              </div>
            </div>
            <span className="text-[11px] font-mono text-neutral-500">
              {currentUser.role}
            </span>
          </div>

          {/* Primary 7 Modules (No menus for products, clients, purchases, or inventory!) */}
          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveModule(item.id);
                  setFeedback(null);
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 w-full text-left cursor-pointer ${
                  activeModule === item.id
                    ? 'bg-[#7A1C24] text-white font-semibold'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Secondary Access: Role Switcher for Testing, Help/Support, and Logout (Section 5) */}
        <div className="p-4 border-t border-neutral-200 space-y-3 text-xs">
          <a href="/clientes" className="block py-2 font-semibold text-[#7A1C24]">Mis clientes</a>
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-neutral-600">
            <a
              href="https://wa.me/50499009900"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-neutral-950"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Ayuda y soporte</span>
            </a>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-red-700 hover:text-red-900 font-medium cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Contract */}
        <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between gap-6">
          <div className="text-xs text-neutral-600 truncate">
            <span>{company?.commercialName || 'Empresa'}</span>
            <span className="mx-2 text-neutral-400">·</span>
            <span className="font-mono">RTN {company?.rtn || ''}</span>
            <span className="mx-2 text-neutral-400">/</span>
            <strong className="text-neutral-950">
              {menuItems.find((m) => m.id === activeModule)?.label}
            </strong>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {currentUser.role !== 'CONSULTA' && (
              <button
                onClick={() => {
                  resetNewDocumentForm();
                  setActiveModule('CREAR_DOCUMENTO');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#7A1C24] hover:bg-[#60141B] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva factura</span>
              </button>
            )}
          </div>
        </header>

        <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Single-Use Email Verification Banner if newly registered (Section 4) */}
          {!emailVerifiedState && pendingVerifyToken && (
            <div className="p-4 bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <strong>Verificación de correo requerida (Sección 4):</strong> Hemos generado su enlace
                de verificación de un solo uso para <strong>{currentUser.email}</strong>.
              </div>
              <button
                onClick={handleVerifyEmailSingleUse}
                className="px-4 py-2 bg-[#7A1C24] text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Verificar correo ahora (1 solo uso)
              </button>
            </div>
          )}

          {/* Commercial Activation or Expired Subscription Banner (Section 4 & 17) */}
          {fiscalStatus && !fiscalStatus.canEmitCommercial && (
            <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <strong>
                  Emisión fiscal bloqueada por estado comercial (
                  {fiscalStatus.subscription?.status || 'PENDIENTE'}):
                </strong>{' '}
                {fiscalStatus.subscription?.status === 'PENDIENTE_ACTIVACION'
                  ? 'Para habilitar la emisión de documentos fiscales debe cubrir la activación única de L 4,000.00 y contar con la aprobación del superadministrador BWP.'
                  : 'Su suscripción mensual de L 350.00 se encuentra vencida. Sus documentos históricos están disponibles para consulta, descarga PDF y exportación.'}
              </div>
              <button
                onClick={() => setActiveModule('MI_SUSCRIPCION')}
                className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ir a Mi Suscripción
              </button>
            </div>
          )}

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-3.5 border text-xs font-medium flex items-center justify-between gap-4 ${
                feedback.type === 'OK'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-red-50 border-red-200 text-red-950'
              }`}
            >
              <span>{feedback.text}</span>
              <button onClick={() => setFeedback(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ===================================================================== */}
          {/* MODULE 1: INICIO / DASHBOARD (Section 6)                              */}
          {/* ===================================================================== */}
          {activeModule === 'INICIO' && (
            <div className="space-y-6">
              {/* Primary 4 KPI Grid matching Page 5 & 14 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-neutral-200 p-5">
                  <div className="text-xs text-neutral-500">Facturado este mes (Ventas Fiscales)</div>
                  <div className="font-display font-bold text-2xl text-neutral-950 font-mono tabular-nums mt-1">
                    {formatCurrency(fiscalStatus?.metrics?.facturadoMes || '0')}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1 font-mono tabular-nums">
                    Hoy: {formatCurrency(fiscalStatus?.metrics?.facturadoHoy || '0')}
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 p-5">
                  <div className="text-xs text-neutral-500">Facturas fiscales emitidas</div>
                  <div className="font-display font-bold text-2xl text-neutral-950 font-mono tabular-nums mt-1">
                    {fiscalStatus?.metrics?.facturasEmitidasCount ?? 0}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Recibos: {fiscalStatus?.metrics?.recibosEmitidosCount ?? 0} · Cotizaciones:{' '}
                    {fiscalStatus?.metrics?.cotizacionesCount ?? 0} · Anulados:{' '}
                    {fiscalStatus?.metrics?.anuladosCount ?? 0}
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 p-5">
                  <div className="text-xs text-neutral-500">Correlativos disponibles (CAI Activo)</div>
                  <div className="font-display font-bold text-2xl text-[#7A1C24] font-mono tabular-nums mt-1">
                    {fiscalStatus?.caiSummary ? fiscalStatus.caiSummary.available : 0}
                  </div>
                  <div className="text-xs text-neutral-600 mt-1 font-mono tabular-nums">
                    Próximo: {fiscalStatus?.caiSummary?.nextFiscalNumber || 'Sin CAI activo'}
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 p-5">
                  <div className="text-xs text-neutral-500">Vigencia CAI y Suscripción</div>
                  <div className="font-display font-bold text-2xl text-neutral-950 font-mono tabular-nums mt-1">
                    {fiscalStatus?.caiSummary
                      ? `Vence en ${fiscalStatus.caiSummary.vigencia.daysRemaining} días`
                      : 'Sin CAI'}
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">
                    Límite:{' '}
                    {fiscalStatus?.caiSummary
                      ? formatHondurasDateDisplay(fiscalStatus.caiSummary.limitDate)
                      : 'N/A'}{' '}
                    · Suscripción: {fiscalStatus?.subscription?.status || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Quick Action & Six-Month Fiscal Evolution Bar Chart (Section 6) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-neutral-200 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-base text-neutral-950">
                        Evolución de Facturación Fiscal (Últimos 6 meses)
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Excluye recibos simples, cotizaciones y documentos anulados
                      </p>
                    </div>
                    <span className="text-xs font-mono text-neutral-500">Zona: America/Tegucigalpa</span>
                  </div>

                  <div className="grid grid-cols-6 gap-3 items-end h-40 pt-6 px-2 border-b border-neutral-200">
                    {[
                      { month: 'Jun', amount: 42500, pct: 45 },
                      { month: 'Jul', amount: 58900, pct: 62 },
                      { month: 'Ago', amount: 51200, pct: 54 },
                      { month: 'Sep', amount: 69400, pct: 73 },
                      { month: 'Oct', amount: 78100, pct: 82 },
                      {
                        month: 'Nov',
                        amount: Number(fiscalStatus?.metrics?.facturadoMes || 85420),
                        pct: 95,
                      },
                    ].map((bar) => (
                      <div key={bar.month} className="flex flex-col items-center gap-1.5 h-full justify-end">
                        <div className="text-[10px] font-mono tabular-nums text-neutral-600">
                          L {(bar.amount / 1000).toFixed(1)}k
                        </div>
                        <div
                          style={{ height: `${bar.pct}%` }}
                          className="w-full max-w-[38px] bg-[#7A1C24] transition-all"
                        />
                        <div className="text-xs font-medium text-neutral-700 pb-1">{bar.month}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Automatic Alerts Panel (Section 8.2, 8.3 & 27) */}
                <div className="lg:col-span-5 bg-white border border-neutral-200 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-base text-neutral-950">
                      Alertas Automáticas y Vigencia ({unreadNotifsCount})
                    </h3>
                    <button
                      onClick={async () => {
                        await fetch('/api/company', {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ action: 'MARK_NOTIFICATIONS_READ' }),
                        });
                        loadAllPortalData();
                      }}
                      className="text-xs text-[#7A1C24] hover:underline cursor-pointer"
                    >
                      Marcar leídas
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-48 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-xs text-neutral-500 p-4 border border-dashed border-neutral-200">
                        Sin alertas pendientes.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 border text-xs space-y-1 ${
                            n.severity === 'CRITICAL'
                              ? 'bg-red-50 border-red-200 text-red-950'
                              : n.severity === 'WARNING'
                                ? 'bg-amber-50 border-amber-200 text-amber-950'
                                : 'bg-neutral-50 border-neutral-200 text-neutral-800'
                          }`}
                        >
                          <div className="font-semibold">{n.title}</div>
                          <div className="text-[11px] leading-relaxed">{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Latest Documents Table on Dashboard */}
              <div className="bg-white border border-neutral-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-base text-neutral-950">
                    Últimos documentos registrados
                  </h3>
                  <button
                    onClick={() => setActiveModule('DOCUMENTOS_EMITIDOS')}
                    className="text-xs font-semibold text-[#7A1C24] hover:underline cursor-pointer"
                  >
                    Ver historial completo y reportes
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500">
                        <th className="py-2.5 px-3">Número Fiscal</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Cliente / RTN</th>
                        <th className="py-2.5 px-3">Fecha Local</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Acciones Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {documents.slice(0, 5).map((d) => (
                        <tr key={d.id} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-3 font-mono tabular-nums font-semibold">
                            {d.fiscalNumber}
                          </td>
                          <td className="py-2.5 px-3">{d.docType}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-neutral-900">{d.clientName}</div>
                            <div className="font-mono text-[11px] text-neutral-500">
                              {d.clientRtn || 'CONSUMIDOR FINAL'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            {formatHondurasDateDisplay(d.issueDateLocal)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            <span
                              className={
                                d.status === 'EMITIDO'
                                  ? 'text-emerald-700'
                                  : d.status === 'ANULADO'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                              }
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                            {formatCurrency(d.totals.totalFiscal, d.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedDocModal(d)}
                              className="text-neutral-700 hover:text-neutral-950 underline cursor-pointer"
                            >
                              Ver
                            </button>
                            <button
                              onClick={() => handleDownloadPdf(d.id, d.pdfFilename)}
                              className="text-[#7A1C24] hover:underline font-medium cursor-pointer"
                            >
                              PDF
                            </button>
                            <button
                              onClick={() => handleOpenShareModal(d)}
                              className="text-emerald-700 hover:underline font-medium cursor-pointer"
                            >
                              WhatsApp
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* MODULE 2: CREAR DOCUMENTO (Section 9, 11, 12, 13)                     */}
          {/* ===================================================================== */}
          {activeModule === 'CREAR_DOCUMENTO' && (
            <div className="space-y-6">
              {currentUser.role === 'CONSULTA' ? (
                <div className="p-6 bg-white border border-neutral-200 text-xs text-neutral-700">
                  Su cuenta tiene asignado el rol <strong>CONSULTA</strong>. Por política de seguridad en
                  servidor (Sección 19), únicamente los roles <strong>PROPIETARIO</strong> y{' '}
                  <strong>FACTURADOR</strong> pueden crear o emitir documentos.
                </div>
              ) : emittedSuccessDoc ? (
                /* Post-Emission Success Screen matching Page 11 (Section 13) */
                <div className="bg-white border border-neutral-200 p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
                  <div className="border-b border-neutral-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-emerald-700">
                        Transacción fiscal confirmada · Secuencia bloqueada e idempotente
                      </div>
                      <h2 className="font-display font-bold text-xl text-neutral-950 mt-0.5">
                        Documento generado correctamente
                      </h2>
                    </div>
                    <div className="font-mono tabular-nums text-sm font-bold bg-neutral-100 px-3 py-1.5 border border-neutral-300">
                      {emittedSuccessDoc.fiscalNumber} ·{' '}
                      {formatCurrency(emittedSuccessDoc.totals.totalFiscal, emittedSuccessDoc.currency)}
                    </div>
                  </div>

                  {/* If PDF failure was simulated (Section 12 & 29), show regenerate button without consuming new correlative! */}
                  {emittedSuccessDoc.pdfStatus === 'ERROR' && (
                    <div className="p-4 bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <strong>Prueba Sección 12 y 29 (Fallo PDF post-emisión):</strong> La emisión fiscal
                        quedó registrada con el correlativo{' '}
                        <strong className="font-mono">{emittedSuccessDoc.fiscalNumber}</strong>, pero la
                        generación inicial del archivo PDF reportó error. Puede regenerar el PDF del mismo
                        documento sin consumir otro correlativo.
                      </div>
                      <button
                        onClick={() => handleRegeneratePdf(emittedSuccessDoc.id)}
                        className="px-4 py-2 bg-[#7A1C24] text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Regenerar PDF sin otro número
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleOpenShareModal(emittedSuccessDoc)}
                      className="p-3.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Enviar por WhatsApp (Web Share / Enlace Privado)</span>
                    </button>

                    <button
                      onClick={() =>
                        handleDownloadPdf(emittedSuccessDoc.id, emittedSuccessDoc.pdfFilename)
                      }
                      className="p-3.5 bg-[#7A1C24] hover:bg-[#60141B] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar PDF ({emittedSuccessDoc.pdfFilename})</span>
                    </button>

                    <button
                      onClick={() => handlePrintPdf(emittedSuccessDoc.id)}
                      className="p-3.5 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir documento</span>
                    </button>

                    <button
                      onClick={() => {
                        setEmailDocModal(emittedSuccessDoc);
                        setEmailRecipient(emittedSuccessDoc.clientEmail || '');
                        setEmailConfirmedCheck(false);
                      }}
                      className="p-3.5 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Enviar por correo (SMTP)</span>
                    </button>
                  </div>

                  <div className="pt-2">
                    <InvoiceTemplatePreview payload={emittedSuccessDoc.snapshot} compact />
                  </div>

                  <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
                    <span className="text-xs text-neutral-500 font-mono">
                      Hash SHA-256: {emittedSuccessDoc.pdfHash?.slice(0, 24) || 'Pendiente'}...
                    </span>
                    <button
                      onClick={resetNewDocumentForm}
                      className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      + Crear nuevo documento
                    </button>
                  </div>
                </div>
              ) : (
                /* Document Creation Split Layout: Form on Left (7 cols), Live Preview on Right (5 cols) */
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  <div className="xl:col-span-7 bg-white border border-neutral-200 p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-200">
                      <div>
                        <div className="text-xs font-semibold text-[#7A1C24]">
                          Sección 9 · Emisión rápida en menos de un minuto
                        </div>
                        <h2 className="font-display font-bold text-lg text-neutral-950">
                          Crear documento fiscal o comercial
                        </h2>
                      </div>
                      <span className="text-xs font-mono text-neutral-500">
                        Sin catálogo obligatorio
                      </span>
                    </div>

                    {/* 1. Document Type Selector (Section 9 Table) */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-2">
                        Tipo de documento
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'FACTURA', label: 'Factura fiscal', sub: 'Consume CAI propio' },
                          { id: 'RECIBO', label: 'Recibo de pago', sub: 'Constancia no fiscal' },
                          { id: 'COTIZACION', label: 'Cotización', sub: 'Comercial sin validez fiscal' },
                          { id: 'NOTA_CREDITO', label: 'Nota de crédito', sub: 'Vinculada a factura' },
                          { id: 'NOTA_DEBITO', label: 'Nota de débito', sub: 'Ajuste vinculado a factura' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setDocType(t.id as DocumentType)}
                            className={`p-2.5 border text-left transition-colors cursor-pointer ${
                              docType === t.id
                                ? 'border-[#7A1C24] bg-[#7A1C24]/5 text-neutral-950'
                                : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                            }`}
                          >
                            <div className="text-xs font-semibold">{t.label}</div>
                            <div className="text-[11px] text-neutral-500">{t.sub}</div>
                          </button>
                        ))}

                        {/* Disabled Recibo por Honorarios per Section 9 & 28 */}
                        <div
                          title="Deshabilitado hasta confirmar modalidad permitida con SAR (Sección 9 y 28)"
                          className="p-2.5 border border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed select-none"
                        >
                          <div className="text-xs font-semibold">Recibo por honorarios</div>
                          <div className="text-[10px]">Deshabilitado (Sec. 9 y 28)</div>
                        </div>
                      </div>
                    </div>

                    {/* Linked Invoice Selector if Credit/Debit Note */}
                    {(docType === 'NOTA_CREDITO' || docType === 'NOTA_DEBITO') && (
                      <div className="p-4 bg-amber-50/70 border border-amber-200 space-y-3">
                        <div className="text-xs font-semibold text-amber-950">
                          Vinculación Obligatoria con Factura Fiscal Original (Sección 9 y 15)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-neutral-700 mb-1">
                              Factura original emitida *
                            </label>
                            <select
                              value={relatedDocumentId}
                              onChange={(e) => setRelatedDocumentId(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white"
                            >
                              <option value="">-- Seleccione factura emitida --</option>
                              {documents
                                .filter((d) => d.docType === 'FACTURA' && d.status === 'EMITIDO')
                                .map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.fiscalNumber} · {d.clientName} ({formatCurrency(d.totals.totalFiscal)})
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-neutral-700 mb-1">
                              Motivo de la nota fiscal *
                            </label>
                            <input
                              type="text"
                              placeholder="Descuento posterior o devolución parcial..."
                              value={relatedReason}
                              onChange={(e) => setRelatedReason(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Client / Adquirente Section (Section 9.1) */}
                    <div className="space-y-3 pt-2 border-t border-neutral-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-neutral-800">
                          Datos del Cliente / Adquirente
                        </label>
                        <div className="flex items-center gap-3">
                          {clientSuggestions.length > 0 && (
                            <select
                              onChange={(e) => {
                                const found = clientSuggestions.find((c) => c.name === e.target.value);
                                if (found) {
                                  setIsFinalConsumer(false);
                                  setClientName(found.name);
                                  setClientRtn(found.rtn);
                                  setClientAddress(found.address);
                                  setClientWhatsapp(found.whatsapp);
                                  setClientEmail(found.email);
                                }
                              }}
                              defaultValue=""
                              className="px-2 py-1 text-xs border border-neutral-300 bg-neutral-50"
                            >
                              <option value="">Sugerir cliente anterior...</option>
                              {clientSuggestions.map((c, idx) => (
                                <option key={idx} value={c.name}>
                                  {c.name} ({c.rtn || 'S/R'})
                                </option>
                              ))}
                            </select>
                          )}
                          <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isFinalConsumer}
                              onChange={(e) => {
                                setIsFinalConsumer(e.target.checked);
                                if (e.target.checked) {
                                  setClientName('CONSUMIDOR FINAL');
                                  setClientRtn('');
                                }
                              }}
                              className="accent-[#7A1C24]"
                            />
                            <span>Consumidor Final</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-neutral-600 mb-1">
                            Nombre o Razón Social *
                          </label>
                          <input
                            type="text"
                            disabled={isFinalConsumer}
                            value={isFinalConsumer ? 'CONSUMIDOR FINAL' : clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-neutral-300 disabled:bg-neutral-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-600 mb-1">
                            RTN (14 dígitos, conservar ceros)
                          </label>
                          <input
                            type="text"
                            maxLength={14}
                            inputMode="numeric"
                            disabled={isFinalConsumer}
                            placeholder="08019000123456"
                            value={isFinalConsumer ? '' : clientRtn}
                            onChange={(e) =>
                              setClientRtn(e.target.value.replace(/[^\d]/g, '').slice(0, 14))
                            }
                            className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 disabled:bg-neutral-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-600 mb-1">
                            Dirección del cliente
                          </label>
                          <input
                            type="text"
                            value={clientAddress}
                            onChange={(e) => setClientAddress(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-neutral-300"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-neutral-600 mb-1">
                              WhatsApp (504...)
                            </label>
                            <input
                              type="tel"
                              value={clientWhatsapp}
                              onChange={(e) => setClientWhatsapp(e.target.value)}
                              className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-neutral-600 mb-1">
                              Correo electrónico
                            </label>
                            <input
                              type="email"
                              value={clientEmail}
                              onChange={(e) => setClientEmail(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-neutral-300"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Exonerated Official Fields if any line uses EXONERADO (Section 9.2 & 11) */}
                      {items.some((i) => i.taxTreatment === 'EXONERADO') && (
                        <div className="p-3.5 bg-neutral-50 border border-neutral-300 space-y-2">
                          <div className="text-xs font-semibold text-neutral-900">
                            Respaldo Obligatorio de Exoneración SAR (Sección 9.2 y 11)
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[11px] text-neutral-600 mb-1">
                                Orden de Compra Exenta *
                              </label>
                              <input
                                type="text"
                                placeholder="OCE-2026-0091"
                                value={exoneratedOrder}
                                onChange={(e) => setExoneratedOrder(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-mono border border-neutral-300 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-neutral-600 mb-1">
                                Constancia Reg. Exonerados *
                              </label>
                              <input
                                type="text"
                                placeholder="CRE-8821-2026"
                                value={exoneratedRegistry}
                                onChange={(e) => setExoneratedRegistry(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-mono border border-neutral-300 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-neutral-600 mb-1">
                                Registro SAG (si aplica)
                              </label>
                              <input
                                type="text"
                                placeholder="SAG-1102"
                                value={exoneratedSag}
                                onChange={(e) => setExoneratedSag(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-mono border border-neutral-300 bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Free Concepts Lines (Section 9.1 & 9.2) */}
                    <div className="space-y-3 pt-2 border-t border-neutral-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-neutral-800">
                          Conceptos libres (Sin movimientos de inventario)
                        </label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={taxIncluded}
                              onChange={(e) => setTaxIncluded(e.target.checked)}
                              className="accent-[#7A1C24]"
                            />
                            <span>Precios incluyen ISV (Base = Importe / (1 + tasa))</span>
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setItems((prev) => [
                                ...prev,
                                {
                                  id: `line-${Date.now()}`,
                                  quantity: '1',
                                  description: '',
                                  unitPrice: '0.00',
                                  discount: '0',
                                  taxTreatment: 'ISV_15',
                                },
                              ])
                            }
                            className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer"
                          >
                            + Agregar línea
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {items.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="p-3 bg-neutral-50 border border-neutral-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                          >
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-neutral-500 mb-0.5">
                                Cantidad
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={item.quantity}
                                onChange={(e) => {
                                  const next = [...items];
                                  next[idx] = { ...next[idx], quantity: e.target.value };
                                  setItems(next);
                                }}
                                className="w-full px-2 py-1.5 text-xs font-mono border border-neutral-300 bg-white"
                              />
                            </div>

                            <div className="sm:col-span-4">
                              <label className="block text-[10px] text-neutral-500 mb-0.5">
                                Descripción libre del concepto
                              </label>
                              <input
                                type="text"
                                placeholder="Escriba el servicio o concepto..."
                                value={item.description}
                                onChange={(e) => {
                                  const next = [...items];
                                  next[idx] = { ...next[idx], description: e.target.value };
                                  setItems(next);
                                }}
                                className="w-full px-2 py-1.5 text-xs border border-neutral-300 bg-white"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-neutral-500 mb-0.5">
                                Precio Unit.
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const next = [...items];
                                  next[idx] = { ...next[idx], unitPrice: e.target.value };
                                  setItems(next);
                                }}
                                className="w-full px-2 py-1.5 text-xs font-mono border border-neutral-300 bg-white"
                              />
                            </div>

                            <div className="sm:col-span-1">
                              <label className="block text-[10px] text-neutral-500 mb-0.5">
                                Desc.
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.discount}
                                onChange={(e) => {
                                  const next = [...items];
                                  next[idx] = { ...next[idx], discount: e.target.value };
                                  setItems(next);
                                }}
                                className="w-full px-1.5 py-1.5 text-xs font-mono border border-neutral-300 bg-white"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-neutral-500 mb-0.5">
                                Tratamiento
                              </label>
                              <select
                                value={item.taxTreatment}
                                onChange={(e) => {
                                  const next = [...items];
                                  next[idx] = {
                                    ...next[idx],
                                    taxTreatment: e.target.value as TaxTreatment,
                                  };
                                  setItems(next);
                                }}
                                className="w-full px-1.5 py-1.5 text-xs border border-neutral-300 bg-white"
                              >
                                <option value="ISV_15">ISV 15%</option>
                                <option value="ISV_18">ISV 18%</option>
                                <option value="EXENTO">Exento</option>
                                <option value="EXONERADO">Exonerado</option>
                                <option value="ALICUOTA_CERO">Alícuota 0%</option>
                              </select>
                            </div>

                            <div className="sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                disabled={items.length <= 1}
                                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                className="p-1.5 text-neutral-400 hover:text-red-700 disabled:opacity-30 cursor-pointer"
                                title="Quitar línea"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. General Discount, Retenciones, Currency & Payment Method */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-neutral-200">
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1">
                          Descuento General
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={generalDiscount}
                          onChange={(e) => setGeneralDiscount(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-neutral-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1">
                          Retención Separada
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={retencionAmount}
                          onChange={(e) => setRetencionAmount(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-neutral-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1">Moneda</label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as 'HNL' | 'USD')}
                          className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 bg-white"
                        >
                          <option value="HNL">Lempiras (L / HNL)</option>
                          <option value="USD">Dólares (US$ / USD)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1">
                          Forma de Pago
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) =>
                            setPaymentMethod(
                              e.target.value as 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO'
                            )
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 bg-white"
                        >
                          <option value="EFECTIVO">Efectivo</option>
                          <option value="TRANSFERENCIA">Transferencia</option>
                          <option value="TARJETA">Tarjeta</option>
                          <option value="CREDITO">Crédito</option>
                        </select>
                      </div>
                    </div>



                    {/* 5. Action Buttons (Section 9.3) */}
                    <div className="pt-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        disabled={emitting}
                        onClick={handleSaveDraft}
                        className="px-4 py-2.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 cursor-pointer"
                      >
                        Guardar borrador (No consume CAI)
                      </button>

                      <button
                        type="button"
                        disabled={emitting || !liveCalculation}
                        onClick={() => setConfirmEmitModal(true)}
                        className="px-6 py-2.5 text-xs font-semibold text-white bg-[#7A1C24] hover:bg-[#60141B] disabled:opacity-50 cursor-pointer"
                      >
                        {emitting ? 'Procesando transacción...' : 'Emitir documento'}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Live Preview with BORRADOR watermark */}
                  <div className="xl:col-span-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <span className="font-semibold">
                        Vista Previa en Tiempo Real (Marca BORRADOR · Sin consumo de número)
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveModule('PLANTILLAS')}
                        className="text-[#7A1C24] hover:underline cursor-pointer"
                      >
                        Cambiar plantilla ({company?.defaultTemplate})
                      </button>
                    </div>
                    {liveDraftPreviewPayload ? (
                      <InvoiceTemplatePreview payload={liveDraftPreviewPayload} compact />
                    ) : (
                      <div className="p-8 bg-white border border-neutral-200 text-center text-xs text-neutral-500">
                        Revise las cantidades o descuentos para calcular la vista previa.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================================================================== */}
          {/* MODULE 3: DOCUMENTOS EMITIDOS & REPORTES (Section 14, 15, 16)         */}
          {/* ===================================================================== */}
          {activeModule === 'DOCUMENTOS_EMITIDOS' && (
            <div className="space-y-6">
              {/* Filters Bar (Section 14) */}
              <div className="bg-white border border-neutral-200 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display font-bold text-lg text-neutral-950">
                      Documentos emitidos, borradores, anulaciones y reportes
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Total Ventas Fiscales filtradas:{' '}
                      <strong className="font-mono text-neutral-900">
                        {formatCurrency(docSummary.filteredFiscalTotal)}
                      </strong>{' '}
                      · Recibos/Cotizaciones no fiscales:{' '}
                      <strong className="font-mono text-neutral-700">
                        {formatCurrency(docSummary.filteredNonFiscalTotal)}
                      </strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={filterSortBy}
                      onChange={(e) => setFilterSortBy(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-neutral-300 bg-white"
                    >
                      <option value="date_desc">Ordenar: Más recientes</option>
                      <option value="date_asc">Ordenar: Más antiguos</option>
                      <option value="number_desc">Número fiscal (Desc)</option>
                      <option value="number_asc">Número fiscal (Asc)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  <div className="lg:col-span-2 relative">
                    <input
                      type="text"
                      placeholder="Buscar cliente, RTN, número fiscal o CAI..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs border border-neutral-300"
                    />
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                  </div>

                  <select
                    value={filterDocType}
                    onChange={(e) => setFilterDocType(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-neutral-300 bg-white"
                  >
                    <option value="ALL">Todos los tipos</option>
                    <option value="FACTURA">Factura fiscal</option>
                    <option value="RECIBO">Recibo de pago</option>
                    <option value="COTIZACION">Cotización</option>
                    <option value="NOTA_CREDITO">Nota de crédito</option>
                    <option value="NOTA_DEBITO">Nota de débito</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-neutral-300 bg-white"
                  >
                    <option value="ALL">Todos los estados</option>
                    <option value="EMITIDO">Emitido</option>
                    <option value="BORRADOR">Borrador</option>
                    <option value="ANULADO">Anulado</option>
                  </select>

                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-neutral-300"
                    title="Desde fecha"
                  />

                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-neutral-300"
                    title="Hasta fecha"
                  />
                </div>
              </div>

              {/* Documents Table */}
              <div className="bg-white border border-neutral-200 p-5">
                {documents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    No se encontraron documentos con los filtros seleccionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="py-2.5 px-3">Número Fiscal</th>
                          <th className="py-2.5 px-3">Tipo / Plantilla</th>
                          <th className="py-2.5 px-3">Cliente / RTN</th>
                          <th className="py-2.5 px-3">Fecha Local</th>
                          <th className="py-2.5 px-3">Estado / PDF</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                          <th className="py-2.5 px-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {documents.map((d) => (
                          <tr key={d.id} className="hover:bg-neutral-50">
                            <td className="py-3 px-3">
                              <div className="font-mono tabular-nums font-bold text-neutral-950">
                                {d.fiscalNumber}
                              </div>
                              <div className="font-mono text-[10px] text-neutral-400 truncate max-w-[160px]">
                                {d.caiCode || 'Sin CAI (No fiscal)'}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-medium">{d.docType}</div>
                              <div className="text-[11px] text-neutral-500">
                                {d.templateUsed} · {d.paymentMethod}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-neutral-900">{d.clientName}</div>
                              <div className="font-mono text-[11px] text-neutral-500">
                                {d.clientRtn || 'CONSUMIDOR FINAL'}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums">
                              {formatHondurasDateDisplay(d.issueDateLocal)}
                            </td>
                            <td className="py-3 px-3">
                              <div
                                className={`font-semibold ${
                                  d.status === 'EMITIDO'
                                    ? 'text-emerald-700'
                                    : d.status === 'ANULADO'
                                      ? 'text-red-700'
                                      : 'text-amber-700'
                                }`}
                              >
                                {d.status}
                              </div>
                              <div className="text-[10px] text-neutral-500">
                                PDF: {d.pdfStatus} (v{d.pdfVersion || 1})
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums font-bold">
                              {formatCurrency(d.totals.totalFiscal, d.currency)}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                              <button
                                onClick={() => setSelectedDocModal(d)}
                                className="px-2 py-1 border border-neutral-300 hover:bg-neutral-100 text-neutral-800 cursor-pointer"
                                title="Visualizar documento e historial"
                              >
                                Ver
                              </button>
                              {d.pdfStatus === 'ERROR' ? (
                                <button
                                  onClick={() => handleRegeneratePdf(d.id)}
                                  className="px-2 py-1 bg-amber-700 text-white font-semibold cursor-pointer"
                                  title="Regenerar PDF sin consumir otro correlativo"
                                >
                                  Regenerar PDF
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDownloadPdf(d.id, d.pdfFilename)}
                                  className="px-2 py-1 border border-neutral-300 hover:bg-neutral-100 text-[#7A1C24] font-semibold cursor-pointer"
                                  title="Descargar PDF (no consume número)"
                                >
                                  PDF
                                </button>
                              )}
                              <button
                                onClick={() => handlePrintPdf(d.id)}
                                className="px-2 py-1 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                                title="Imprimir"
                              >
                                Imprimir
                              </button>
                              <button
                                onClick={() => handleOpenShareModal(d)}
                                className="px-2 py-1 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium cursor-pointer"
                                title="Compartir por WhatsApp / Enlace privado"
                              >
                                WhatsApp
                              </button>
                              <button
                                onClick={() => {
                                  setEmailDocModal(d);
                                  setEmailRecipient(d.clientEmail || '');
                                  setEmailConfirmedCheck(false);
                                }}
                                className="px-2 py-1 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                                title="Enviar por correo"
                              >
                                Correo
                              </button>
                              {currentUser.role !== 'CONSULTA' && (
                                <button
                                  onClick={() => handleDuplicateAsNewDraft(d)}
                                  className="px-2 py-1 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                                  title="Duplicar conceptos como nuevo borrador sin reutilizar número"
                                >
                                  Duplicar
                                </button>
                              )}
                              {currentUser.role === 'PROPIETARIO' && d.status === 'EMITIDO' && (
                                <button
                                  onClick={() => {
                                    setVoidDocModal(d);
                                    setVoidReason('');
                                  }}
                                  className="px-2 py-1 border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 font-medium cursor-pointer"
                                  title="Anulación controlada (Correlativo nunca reutilizable)"
                                >
                                  Anular
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 16: Reportes y Exportación (Inside Documentos Emitidos, no independent accounting menu) */}
              <div className="bg-white border border-neutral-200 p-6 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-[#7A1C24]">
                    Sección 16 · Reportes y Exportación Fiscal / Contable
                  </div>
                  <h3 className="font-display font-bold text-base text-neutral-950">
                    Exportar reportes para contador y conciliación SAR (Respeta filtros de fecha y
                    aislamiento)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Separa recibos y cotizaciones de la facturación fiscal y ajustes para evitar duplicar
                    ingresos.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'FACTURACION',
                      title: '1. Facturación diaria, mensual y anual',
                      desc: 'Ventas fiscales SAR separadas de constancias no fiscales',
                    },
                    {
                      id: 'ANULADOS',
                      title: '2. Documentos anulados',
                      desc: 'Motivo legal, usuario responsable, fecha/hora y correlativo bloqueado',
                    },
                    {
                      id: 'CORRELATIVOS',
                      title: '3. Correlativos usados y no usados',
                      desc: 'Utilizados, anulados y disponibles por cada autorización CAI',
                    },
                    {
                      id: 'RESUMEN_ISV',
                      title: '4. Resumen ISV por tratamiento',
                      desc: 'Bases Exenta, Exonerada, Tasa 0%, Gravada 15% y 18% e ISV',
                    },
                    {
                      id: 'HISTORIAL_CAI',
                      title: '5. Historial CAI',
                      desc: 'Autorizaciones históricas, fechas límite y respaldos PDF',
                    },
                    {
                      id: 'INTEGRACION_CONTABLE',
                      title: '6. Integración fiscal / contable',
                      desc: 'Cola de asientos contables conciliados (CSV / TXT)',
                    },
                  ].map((rep) => (
                    <div
                      key={rep.id}
                      className="p-4 border border-neutral-200 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-semibold text-neutral-950">{rep.title}</div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">{rep.desc}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleExportReport(rep.id, 'CSV')}
                          className="px-3 py-1.5 bg-[#7A1C24] hover:bg-[#60141B] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Excel / CSV</span>
                        </button>
                        <button
                          onClick={() => handleExportReport(rep.id, 'TXT')}
                          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 text-xs font-medium cursor-pointer"
                        >
                          TXT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* MODULE 4: CAI Y CORRELATIVOS (Section 8, 8.1, 8.2, 8.3)               */}
          {/* ===================================================================== */}
          {activeModule === 'CAI_CORRELATIVOS' && (
            <div className="space-y-6">
              {/* Active CAI Highlight Box matching Page 7 */}
              {fiscalStatus?.caiSummary && (
                <div className="bg-white border border-neutral-200 p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-200">
                    <div>
                      <div className="text-xs font-semibold text-[#7A1C24]">
                        Autorización Activa · Factura Fiscal
                      </div>
                      <h3 className="font-display font-bold text-lg text-neutral-950 font-mono">
                        CAI: {fiscalStatus.caiSummary.cai}
                      </h3>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">
                      Estado: ACTIVO ({fiscalStatus.caiSummary.vigencia.label})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500">Correlativos Utilizados</div>
                      <div className="font-display font-bold text-lg font-mono tabular-nums mt-0.5">
                        {fiscalStatus.caiSummary.lastUsed} / {fiscalStatus.caiSummary.rangeEnd} utilizados
                      </div>
                    </div>
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500">Disponibles</div>
                      <div className="font-display font-bold text-lg text-[#7A1C24] font-mono tabular-nums mt-0.5">
                        {fiscalStatus.caiSummary.available} disponibles
                      </div>
                    </div>
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500">Próximo Correlativo</div>
                      <div className="font-display font-bold text-base font-mono tabular-nums mt-0.5">
                        {fiscalStatus.caiSummary.nextFiscalNumber}
                      </div>
                    </div>
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500">Fecha Límite de Emisión</div>
                      <div className="font-display font-bold text-lg font-mono tabular-nums mt-0.5">
                        {formatHondurasDateDisplay(fiscalStatus.caiSummary.limitDate)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Authorizations Table */}
              <div className="bg-white border border-neutral-200 p-6 space-y-4">
                <div>
                  <h3 className="font-display font-bold text-base text-neutral-950">
                    Historial de Autorizaciones CAI por Establecimiento, Punto de Emisión y Tipo
                  </h3>
                  <p className="text-xs text-neutral-500">
                    El CAI se ingresa según autorización real del SAR; nunca se genera ni renueva por cuenta
                    del software.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500">
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">CAI / Respaldo SAR</th>
                        <th className="py-2.5 px-3">Rango Inicial / Final</th>
                        <th className="py-2.5 px-3">Último / Próximo</th>
                        <th className="py-2.5 px-3">Usados / Anulados / Disp.</th>
                        <th className="py-2.5 px-3">Vigencia</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {authorizations.map((c) => (
                        <tr key={c.id} className="hover:bg-neutral-50">
                          <td className="py-3 px-3 font-semibold">{c.docType}</td>
                          <td className="py-3 px-3">
                            <div className="font-mono font-semibold text-neutral-900">{c.cai}</div>
                            <div className="text-sm text-neutral-500">{c.supportPdfDataUrl ? <a href={c.supportPdfDataUrl} download={c.supportPdfName} className="underline">Descargar respaldo SAR</a> : c.supportPdfName}</div>
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-[11px]">
                            <div>De: {c.rangeStartFormatted}</div>
                            <div>A: {c.rangeEndFormatted}</div>
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-[11px]">
                            <div>Últ: {c.lastUsedFormatted}</div>
                            <div className="text-[#7A1C24] font-semibold">
                              Próx: {c.nextFiscalNumber}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums">
                            {c.usedCount} usados · {c.annulledCount} anul. ·{' '}
                            <strong>{c.available} disp.</strong>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono tabular-nums">
                              {formatHondurasDateDisplay(c.limitDate)}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {c.vigenciaAlert?.label}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold">{c.status}</td>
                          <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                            {currentUser.role === 'PROPIETARIO' && c.status !== 'ACTIVO' && (
                              <button
                                onClick={() => handleChangeCaiStatus(c.id, 'ACTIVO')}
                                className="px-2.5 py-1 bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Activar
                              </button>
                            )}
                            {currentUser.role === 'PROPIETARIO' && c.status === 'ACTIVO' && (
                              <button
                                onClick={() => handleChangeCaiStatus(c.id, 'ARCHIVADO')}
                                className="px-2.5 py-1 bg-neutral-200 text-neutral-800 text-[11px] font-medium cursor-pointer"
                              >
                                Archivar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Register New CAI Form (Propietario only) */}
              {currentUser.role === 'PROPIETARIO' && (
                <form
                  onSubmit={handleRegisterCai}
                  className="bg-white border border-neutral-200 p-6 space-y-4"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#7A1C24]">
                      Sección 8 y 8.1 · Registro y Validación de Nueva Autorización SAR
                    </div>
                    <h3 className="font-display font-bold text-base text-neutral-950">
                      Registrar nuevo CAI (Con validación de prefijos, vigencia, no superposición y
                      migración)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Tipo documental *
                      </label>
                      <select
                        value={newCaiDocType}
                        onChange={(e) => setNewCaiDocType(e.target.value as DocumentType)}
                        className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white"
                      >
                        <option value="FACTURA">Factura Fiscal (01)</option>
                        <option value="NOTA_CREDITO">Nota de Crédito (06)</option>
                        <option value="NOTA_DEBITO">Nota de Débito (07)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Código CAI autorizado por el SAR *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX"
                        value={newCaiCode}
                        onChange={(e) => setNewCaiCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Establecimiento
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={newCaiEst}
                        onChange={(e) => setNewCaiEst(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Punto Emisión
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={newCaiPt}
                        onChange={(e) => setNewCaiPt(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Rango Inicial *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={newCaiRangeStart}
                        onChange={(e) => setNewCaiRangeStart(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Rango Final *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={newCaiRangeEnd}
                        onChange={(e) => setNewCaiRangeEnd(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Último Usado (Migración)
                      </label>
                      <input
                        type="number"
                        placeholder="Opcional"
                        value={newCaiMigratedLast}
                        onChange={(e) => setNewCaiMigratedLast(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Fecha de Autorización *
                      </label>
                      <input
                        type="date"
                        required
                        value={newCaiAuthDate}
                        onChange={(e) => setNewCaiAuthDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Fecha Límite de Emisión *
                      </label>
                      <input
                        type="date"
                        required
                        value={newCaiLimitDate}
                        onChange={(e) => setNewCaiLimitDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        PDF de Respaldo Autorización SAR
                      </label>
                      <input
                        type="file" accept="application/pdf"
                        onChange={(e) => {const f=e.target.files?.[0];setNewCaiPdfName(f?.name || '');readAttachment(f,setSupportPdfDataUrl);}}
                        className="w-full px-3 py-2 text-xs border border-neutral-300"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#7A1C24] hover:bg-[#60141B] text-white text-xs font-semibold cursor-pointer"
                  >
                    Validar y activar nueva autorización CAI
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ===================================================================== */}
          {/* MODULE 5: MI EMPRESA, USUARIOS E INTEGRACIÓN CONTABLE (Sec. 7, 19, 28)*/}
          {/* ===================================================================== */}
          {activeModule === 'MI_EMPRESA' && company && (
            <div className="space-y-6">
              {/* Company Fiscal Data Form (Section 7) */}
              <form
                onSubmit={handleSaveCompanyProfile}
                className="bg-white border border-neutral-200 p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-200">
                  <div>
                    <div className="text-xs font-semibold text-[#7A1C24]">
                      Sección 7 · Datos Oficiales del Contribuyente
                    </div>
                    <h2 className="font-display font-bold text-lg text-neutral-950">
                      Configuración fiscal de Mi Empresa
                    </h2>
                  </div>
                  <span className="text-xs text-neutral-500">
                    Cambios solo afectan documentos nuevos (Histórico conserva instantánea original)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Razón Social Oficial *
                    </label>
                    <input
                      type="text"
                      value={company.legalName}
                      onChange={(e) => setCompany({ ...company, legalName: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Nombre Comercial *
                    </label>
                    <input
                      type="text"
                      value={company.commercialName}
                      onChange={(e) => setCompany({ ...company, commercialName: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      RTN (14 dígitos, conservar ceros) *
                    </label>
                    <input
                      type="text"
                      maxLength={14}
                      value={company.rtn}
                      onChange={(e) =>
                        setCompany({
                          ...company,
                          rtn: e.target.value.replace(/[^\d]/g, '').slice(0, 14),
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Dirección Fiscal Casa Matriz *
                    </label>
                    <input
                      type="text"
                      value={company.addressMatriz}
                      onChange={(e) => setCompany({ ...company, addressMatriz: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Dirección del Establecimiento Emisor *
                    </label>
                    <input
                      type="text"
                      value={company.addressEstablecimiento}
                      onChange={(e) =>
                        setCompany({ ...company, addressEstablecimiento: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Departamento
                    </label>
                    <input
                      type="text"
                      value={company.department}
                      onChange={(e) => setCompany({ ...company, department: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Municipio
                    </label>
                    <input
                      type="text"
                      value={company.municipality}
                      onChange={(e) => setCompany({ ...company, municipality: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={company.phone}
                      onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Correo Fiscal
                    </label>
                    <input
                      type="email"
                      value={company.email}
                      onChange={(e) => setCompany({ ...company, email: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Actividad Económica Declarada
                    </label>
                    <input
                      type="text"
                      value={company.economicActivity}
                      onChange={(e) => setCompany({ ...company, economicActivity: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Representante Legal / Contribuyente
                    </label>
                    <input
                      type="text"
                      value={company.representative}
                      onChange={(e) => setCompany({ ...company, representative: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Modalidad Fiscal
                    </label>
                    <input
                      type="text"
                      disabled
                      value={company.modality}
                      className="w-full px-3 py-2 text-xs border border-neutral-200 bg-neutral-100 text-neutral-600"
                    />
                  </div>
                </div>

                {currentUser.role === 'PROPIETARIO' && (
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#7A1C24] hover:bg-[#60141B] text-white text-xs font-semibold cursor-pointer"
                  >
                    Guardar cambios de Mi Empresa
                  </button>
                )}
              </form>

              {/* Section 19: Usuarios y Permisos */}
              <div className="bg-white border border-neutral-200 p-6 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-[#7A1C24]">
                    Sección 19 · Control de Acceso Basado en Roles (En Servidor)
                  </div>
                  <h3 className="font-display font-bold text-base text-neutral-950">
                    Usuarios y permisos de la empresa
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500">
                        <th className="py-2.5 px-3">Nombre</th>
                        <th className="py-2.5 px-3">Correo</th>
                        <th className="py-2.5 px-3">Rol</th>
                        <th className="py-2.5 px-3">Emitir</th>
                        <th className="py-2.5 px-3">Configurar / Anular</th>
                        <th className="py-2.5 px-3">Exportar</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {members.map((m) => (
                        <tr key={m.id}>
                          <td className="py-2.5 px-3 font-semibold">{m.userName}</td>
                          <td className="py-2.5 px-3 font-mono">{m.userEmail}</td>
                          <td className="py-2.5 px-3 font-semibold text-[#7A1C24]">{m.role}</td>
                          <td className="py-2.5 px-3">
                            {m.role === 'PROPIETARIO' || m.role === 'FACTURADOR' ? 'Sí' : 'No'}
                          </td>
                          <td className="py-2.5 px-3">{m.role === 'PROPIETARIO' ? 'Sí' : 'No'}</td>
                          <td className="py-2.5 px-3">{m.canExport ? 'Sí' : 'No'}</td>
                          <td className="py-2.5 px-3">{m.status}</td>
                          <td className="py-2.5 px-3 text-right">
                            {currentUser.role === 'PROPIETARIO' &&
                              m.userId !== currentUser.id &&
                              m.status === 'ACTIVO' && (
                                <button
                                  onClick={() => handleRevokeMember(m.id)}
                                  className="text-red-700 hover:underline font-medium cursor-pointer"
                                >
                                  Revocar acceso
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {currentUser.role === 'PROPIETARIO' && (
                  <form
                    onSubmit={handleInviteMember}
                    className="pt-4 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
                  >
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">
                        Nombre del miembro
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Lic. Roberto Gómez"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="usuario@empresa.hn"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">
                        Rol Empresarial
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) =>
                          setInviteRole(
                            e.target.value as 'PROPIETARIO' | 'FACTURADOR' | 'CONSULTA'
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 bg-white"
                      >
                        <option value="FACTURADOR">Facturador (Emitir y consultar)</option>
                        <option value="CONSULTA">Consulta / Contador (Solo lectura)</option>
                        <option value="PROPIETARIO">Propietario (Control total)</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-neutral-700 pb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteCanExport}
                          onChange={(e) => setInviteCanExport(e.target.checked)}
                          className="accent-[#7A1C24]"
                        />
                        <span>Permitir exportar</span>
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      + Invitar miembro
                    </button>
                  </form>
                )}
              </div>

              {/* Section 28: External Accounting Queue & SAR Acuerdo 481-2017 Art. 53 */}
              <div className="bg-white border border-neutral-200 p-6 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-[#7A1C24]">
                    Sección 28 · Validación Legal SAR Honduras (Acuerdo 481-2017 Art. 53)
                  </div>
                  <h3 className="font-display font-bold text-base text-neutral-950">
                    Integración Contable Externa en Segundo Plano y Bitácora de Eventos
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Mapeo de impuestos y documentos con referencias externas e idempotencia sin convertir
                    BWP NEXO en un ERP.
                  </p>
                </div>

                {integrationSetting && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-neutral-50 p-4 border border-neutral-200">
                    <div>
                      <span className="text-neutral-500">Adaptador activo: </span>
                      <strong className="font-mono">{integrationSetting.adapterType}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500">Cuenta Ventas 15%: </span>
                      <strong className="font-mono">{integrationSetting.accountSales15}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500">Cuenta ISV 15%: </span>
                      <strong className="font-mono">{integrationSetting.accountIsv15}</strong>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500">
                        <th className="py-2 px-3">Referencia Externa</th>
                        <th className="py-2 px-3">Evento</th>
                        <th className="py-2 px-3">Documento</th>
                        <th className="py-2 px-3">Resumen de Asiento</th>
                        <th className="py-2 px-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {integrationEvents.slice(0, 8).map((ev) => (
                        <tr key={ev.id}>
                          <td className="py-2 px-3 font-mono font-semibold">
                            {ev.externalReference}
                          </td>
                          <td className="py-2 px-3">{ev.eventType}</td>
                          <td className="py-2 px-3 font-mono">{ev.fiscalNumber}</td>
                          <td className="py-2 px-3 text-neutral-600">{ev.payloadSummary}</td>
                          <td className="py-2 px-3 font-semibold text-emerald-700">{ev.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* MODULE 6: PLANTILLAS (Section 10)                                     */}
          {/* ===================================================================== */}
          {activeModule === 'PLANTILLAS' && company && (
            <div className="space-y-6">
              <div className="bg-white border border-neutral-200 p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-[#7A1C24]">
                      Sección 10 · Tres Plantillas Fiscales Incluidas
                    </div>
                    <h2 className="font-display font-bold text-lg text-neutral-950">
                      Personalización de Diseño, Tamaño Carta/A4 y Color Empresarial
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Las tres presentan los mismos campos fiscales obligatorios; ninguno podrá ocultarse.
                    </p>
                  </div>

                  {currentUser.role === 'PROPIETARIO' && (
                    <button
                      onClick={handleSaveCompanyProfile}
                      className="px-5 py-2.5 bg-[#7A1C24] hover:bg-[#60141B] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Guardar plantilla predeterminada
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      id: 'CLASICA',
                      title: '1. Clásica',
                      desc: 'Formal, monocromática, apta para impresión rápida de alto contraste.',
                    },
                    {
                      id: 'CORPORATIVA',
                      title: '2. Corporativa',
                      desc: 'Encabezado con color empresarial, logotipo e importe total destacado.',
                    },
                    {
                      id: 'MINIMALISTA',
                      title: '3. Minimalista',
                      desc: 'Limpia, bajo consumo de tinta, ideal para servicios profesionales.',
                    },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        setCompany({ ...company, defaultTemplate: tpl.id as TemplateId })
                      }
                      className={`p-4 border text-left transition-colors cursor-pointer ${
                        company.defaultTemplate === tpl.id
                          ? 'border-2 border-[#7A1C24] bg-[#7A1C24]/5'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="font-display font-bold text-sm text-neutral-950">
                        {tpl.title}
                      </div>
                      <p className="text-xs text-neutral-600 mt-1">{tpl.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-neutral-200">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Color Principal Empresarial
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={company.primaryColor || '#7A1C24'}
                        onChange={(e) => setCompany({ ...company, primaryColor: e.target.value })}
                        className="h-9 w-14 border border-neutral-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={company.primaryColor || '#7A1C24'}
                        onChange={(e) => setCompany({ ...company, primaryColor: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Tamaño de Hoja PDF
                    </label>
                    <select
                      value={company.paperSize || 'LETTER'}
                      onChange={(e) =>
                        setCompany({ ...company, paperSize: e.target.value as PaperSize })
                      }
                      className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white"
                    >
                      <option value="LETTER">Carta (Letter · 8.5 x 11 in)</option>
                      <option value="A4">A4 Estándar Internacional</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Datos Bancarios Opcionales en Factura
                    </label>
                    <input
                      type="text"
                      value={company.bankInfo || ''}
                      onChange={(e) => setCompany({ ...company, bankInfo: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Mensaje Personalizado al Pie
                    </label>
                    <input
                      type="text"
                      value={company.footerMessage || ''}
                      onChange={(e) => setCompany({ ...company, footerMessage: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>
                </div>
              </div>

              {/* Live Template Preview */}
              {liveDraftPreviewPayload && (
                <div className="bg-neutral-100 border border-neutral-200 p-6">
                  <InvoiceTemplatePreview
                    payload={liveDraftPreviewPayload}
                    templateOverride={company.defaultTemplate}
                    paperSizeOverride={company.paperSize}
                    primaryColorOverride={company.primaryColor}
                  />
                </div>
              )}
            </div>
          )}

          {/* ===================================================================== */}
          {/* MODULE 7: MI SUSCRIPCIÓN (Section 17)                                 */}
          {/* ===================================================================== */}
          {activeModule === 'MI_SUSCRIPCION' && subscriptionData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-neutral-200 p-5">
                  <div className="text-xs text-neutral-500">Plan Contratado</div>
                  <div className="font-display font-bold text-base text-neutral-950 mt-1">
                    {subscriptionData.subscription?.planName || 'Plan BWP NEXO'}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Conservación histórica garantizada
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 p-5">
                  <div className="text-xs text-neutral-500">Activación Única (L 4,000.00)</div>
                  <div className="font-display font-bold text-xl font-mono tabular-nums mt-1">
                    {subscriptionData.subscription?.activationPaid ? (
                      <span className="text-emerald-700">Pagada y Verificada</span>
                    ) : (
                      <span className="text-amber-700">Pendiente (L 4,000.00)</span>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 p-5">
                  <div className="text-xs text-neutral-500">Mensualidad Recurrente</div>
                  <div className="font-display font-bold text-xl text-neutral-950 font-mono tabular-nums mt-1">
                    L {subscriptionData.pricing?.monthlyPriceHnl || '350.00'} / mes
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Renovación explícita (sin cobros ocultos)
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 p-5">
                  <div className="text-xs text-neutral-500">Estado y Próximo Vencimiento</div>
                  <div className="font-display font-bold text-lg text-[#7A1C24] mt-1">
                    {subscriptionData.subscription?.status}
                  </div>
                  <div className="text-xs text-neutral-600 font-mono tabular-nums mt-1">
                    Próximo pago:{' '}
                    {formatHondurasDateDisplay(subscriptionData.subscription?.nextPaymentDate)} (
                    {subscriptionData.daysRemaining} días)
                  </div>
                </div>
              </div>

              {/* Bank Instructions & Upload Receipt Form (Section 4 & 17) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-white border border-neutral-200 p-6 space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-[#7A1C24]">
                      Sección 4 y 17 · Transferencia y Comprobante
                    </div>
                    <h3 className="font-display font-bold text-base text-neutral-950">
                      Registrar comprobante de pago bancario
                    </h3>
                  </div>

                  <div className="p-3.5 bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 space-y-1">
                    <div className="font-semibold text-neutral-900">
                      Instrucciones Bancarias Oficiales BWP Software:
                    </div>
                    <p>{subscriptionData.bankInstructions}</p>
                  </div>

                  {currentUser.role === 'PROPIETARIO' ? (
                    <form onSubmit={handleSubmitPaymentReceipt} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Concepto de pago
                          </label>
                          <select
                            value={payType}
                            onChange={(e) =>
                              setPayType(e.target.value as 'ACTIVACION_UNICA' | 'MENSUALIDAD')
                            }
                            className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white"
                          >
                            <option value="ACTIVACION_UNICA">
                              Activación Única por Empresa (L 4,000.00)
                            </option>
                            <option value="MENSUALIDAD">
                              Suscripción Mensual por Empresa (L 350.00)
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Banco Emisor
                          </label>
                          <input
                            type="text"
                            required
                            value={payBankName}
                            onChange={(e) => setPayBankName(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-neutral-300"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Número de Referencia Bancaria *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. BAC-10293847"
                            value={payReference}
                            onChange={(e) => setPayReference(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Archivo Comprobante (PDF / Imagen)
                          </label>
                          <input
                            type="file" accept="application/pdf,image/png,image/jpeg"
                            required
                            onChange={(e) => {const f=e.target.files?.[0];setPayFilename(f?.name || '');readAttachment(f,setReceiptDataUrl);}}
                            className="w-full px-3 py-2 text-xs border border-neutral-300"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Notas adicionales
                        </label>
                        <input
                          type="text"
                          placeholder="Comentario opcional para conciliación..."
                          value={payNotes}
                          onChange={(e) => setPayNotes(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-neutral-300"
                        />
                      </div>

                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-[#7A1C24] hover:bg-[#60141B] text-white text-xs font-semibold cursor-pointer"
                      >
                        Subir comprobante para verificación BWP
                      </button>
                    </form>
                  ) : (
                    <div className="text-xs text-neutral-500">
                      Solo el usuario con rol Propietario puede subir comprobantes de suscripción.
                    </div>
                  )}
                </div>

                {/* Payment History */}
                <div className="lg:col-span-6 bg-white border border-neutral-200 p-6 space-y-4">
                  <h3 className="font-display font-bold text-base text-neutral-950">
                    Historial de Pagos y Comprobantes de la Empresa
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="py-2 px-3">Fecha</th>
                          <th className="py-2 px-3">Concepto</th>
                          <th className="py-2 px-3">Referencia</th>
                          <th className="py-2 px-3 text-right">Importe</th>
                          <th className="py-2 px-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {(subscriptionData.payments || []).map(
                          (p: any) => (
                            <tr key={p.id}>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-500">
                                {p.createdAtUtc.slice(0, 10)}
                              </td>
                              <td className="py-2.5 px-3">{p.paymentType}</td>
                              <td className="py-2.5 px-3 font-mono">{p.bankReference}</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                                {formatCurrency(p.amountHnl)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold">
                                <span
                                  className={
                                    p.status === 'APROBADO'
                                      ? 'text-emerald-700'
                                      : p.status === 'RECHAZADO'
                                        ? 'text-red-700'
                                        : 'text-amber-700'
                                  }
                                >
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: IRREVERSIBLE EMISSION CONFIRMATION (Section 9.3)             */}
      {/* ===================================================================== */}
      {confirmEmitModal && liveCalculation && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 max-w-md w-full p-6 space-y-4">
            <div>
              <div className="text-xs font-semibold text-[#7A1C24]">
                Confirmación Irreversible de Emisión (Sección 9.3 y 25)
              </div>
              <h3 className="font-display font-bold text-lg text-neutral-950 mt-0.5">
                ¿Confirmar emisión oficial de {docType}?
              </h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Al confirmar, el servidor asignará un número correlativo único dentro de una transacción con
              bloqueo de secuencia. Una vez emitido, un documento fiscal no puede eliminarse ni editarse.
            </p>
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-500">Cliente:</span>
                <span className="font-semibold">
                  {isFinalConsumer ? 'CONSUMIDOR FINAL' : clientName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">RTN:</span>
                <span className="font-mono">{isFinalConsumer ? 'N/A' : clientRtn || 'S/R'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Total ISV:</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(liveCalculation.totalIsv, currency)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-neutral-950 pt-1 border-t border-neutral-200">
                <span>Total Fiscal:</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(liveCalculation.totalFiscal, currency)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={emitting}
                onClick={() => setConfirmEmitModal(false)}
                className="px-4 py-2 text-xs font-medium border border-neutral-300 hover:bg-neutral-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={emitting}
                onClick={handleIssueDocument}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#7A1C24] hover:bg-[#60141B] disabled:opacity-50 cursor-pointer"
              >
                {emitting ? 'Asignando correlativo...' : 'Confirmar y emitir ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: VIEW DOCUMENT SNAPSHOT & AUDIT (Section 14)                  */}
      {/* ===================================================================== */}
      {selectedDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-neutral-300 max-w-4xl w-full p-6 space-y-4 my-8 relative">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <div className="text-xs font-semibold text-[#7A1C24]">
                  Instantánea Inmutable del Documento · Hash SHA-256:{' '}
                  <span className="font-mono">{selectedDocModal.pdfHash?.slice(0, 16)}...</span>
                </div>
                <h3 className="font-display font-bold text-lg text-neutral-950">
                  {selectedDocModal.docType} No. {selectedDocModal.fiscalNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDocModal(null)}
                className="p-1 text-neutral-500 hover:text-neutral-950 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-2 bg-neutral-100">
              <InvoiceTemplatePreview payload={selectedDocModal.snapshot} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <span className="text-xs text-neutral-500">
                Reimprimir o descargar nunca consume otro correlativo fiscal.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleDownloadPdf(selectedDocModal.id, selectedDocModal.pdfFilename)
                  }
                  className="px-4 py-2 bg-[#7A1C24] text-white text-xs font-semibold cursor-pointer"
                >
                  Descargar PDF
                </button>
                <button
                  onClick={() => handlePrintPdf(selectedDocModal.id)}
                  className="px-4 py-2 border border-neutral-300 text-xs font-semibold cursor-pointer"
                >
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CONTROLLED ANNULMENT / ANULACIÓN (Section 15)                */}
      {/* ===================================================================== */}
      {voidDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleVoidDocumentSubmit}
            className="bg-white border border-neutral-300 max-w-md w-full p-6 space-y-4"
          >
            <div>
              <div className="text-xs font-semibold text-red-700">
                Sección 15 · Anulación Fiscal Controlada
              </div>
              <h3 className="font-display font-bold text-lg text-neutral-950">
                Anular {voidDocModal.docType} {voidDocModal.fiscalNumber}
              </h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              El documento original se conservará intacto con sello de ANULADO, se registrará el usuario,
              fecha/hora y asiento contable de reversión, y el correlativo{' '}
              <strong className="font-mono">{voidDocModal.fiscalNumber}</strong> quedará bloqueado para no
              reutilizarse jamás.
            </p>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Motivo legal de anulación (Obligatorio) *
              </label>
              <textarea
                rows={3}
                required
                minLength={6}
                placeholder="Indique el motivo de la anulación para auditoría SAR..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-300"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidDocModal(null)}
                className="px-4 py-2 text-xs border border-neutral-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white cursor-pointer"
              >
                Confirmar anulación irreversible
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: WHATSAPP & REVOCABLE SHARE LINK (Section 13)                 */}
      {/* ===================================================================== */}
      {shareDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-emerald-700">
                  Sección 13 · Compartir por WhatsApp y Enlaces Privados
                </div>
                <h3 className="font-display font-bold text-lg text-neutral-950">
                  Compartir {shareDocModal.fiscalNumber}
                </h3>
              </div>
              <button
                onClick={() => setShareDocModal(null)}
                className="p-1 text-neutral-500 hover:text-neutral-950 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shareResult ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleWebShareNativeFile(shareDocModal)}
                    className="p-3 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-center cursor-pointer"
                  >
                    Opción 1: Web Share API (Adjuntar PDF en móvil)
                  </button>
                  <a
                    href={`https://wa.me/${sharePhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                      shareResult.whatsappMessage
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-center block"
                  >
                    Opción 2: Abrir WhatsApp (wa.me)
                  </a>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Número Internacional WhatsApp (Confirmar destinatario)
                  </label>
                  <input
                    type="tel"
                    value={sharePhone}
                    onChange={(e) => setSharePhone(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-neutral-300"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Mensaje Oficial con Enlace Privado Temporal y Revocable
                  </label>
                  <textarea
                    rows={4}
                    readOnly
                    value={shareResult.whatsappMessage}
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-200 text-[11px]"
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-neutral-200">
                  <div className="font-semibold text-neutral-800">
                    Enlaces Privados Activos (Hash SHA-256 · Temporal 72h):
                  </div>
                  {(shareResult.shareLinks || []).map(
                    (lnk: any) => (
                      <div
                        key={lnk.id}
                        className="flex items-center justify-between p-2 bg-neutral-50 border border-neutral-200"
                      >
                        <span className="font-mono text-[11px]">
                          Token: {lnk.tokenPreview} ·{' '}
                          {lnk.revoked ? (
                            <strong className="text-red-700">REVOCADO</strong>
                          ) : (
                            <span className="text-emerald-700">
                              Expira {lnk.expiresAtUtc.slice(0, 10)}
                            </span>
                          )}
                        </span>
                        {!lnk.revoked && (
                          <button
                            onClick={() => handleRevokeShareLink(shareDocModal.id, lnk.id)}
                            className="text-red-700 hover:underline font-semibold cursor-pointer"
                          >
                            Revocar enlace
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>

                <div className="text-[11px] text-neutral-500">
                  Nota técnica (Sección 13): Abrir WhatsApp no declara el documento como «enviado» ni asume
                  lectura por el destinatario.
                </div>
              </div>
            ) : (
              <div className="p-4 text-xs text-neutral-500">Generando token privado...</div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: SEND EMAIL VIA SMTP WITH CONFIRMATION (Section 13)           */}
      {/* ===================================================================== */}
      {emailDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSendEmailSubmit}
            className="bg-white border border-neutral-300 max-w-md w-full p-6 space-y-4"
          >
            <div>
              <div className="text-xs font-semibold text-[#7A1C24]">
                Sección 13 · Despacho de Correo vía SMTP
              </div>
              <h3 className="font-display font-bold text-lg text-neutral-950">
                Enviar {emailDocModal.fiscalNumber} por correo
              </h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Correo electrónico del destinatario *
              </label>
              <input
                type="email"
                required
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-300"
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                checked={emailConfirmedCheck}
                onChange={(e) => setEmailConfirmedCheck(e.target.checked)}
                className="mt-0.5 accent-[#7A1C24]"
              />
              <span>
                Confirmo que el correo del destinatario es correcto para adjuntar el PDF fiscal y enlace
                privado. (Se registrará el resultado técnico sin asumir lectura del destinatario).
              </span>
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmailDocModal(null)}
                className="px-4 py-2 text-xs border border-neutral-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-[#7A1C24] hover:bg-[#60141B] text-white cursor-pointer"
              >
                Despachar correo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
