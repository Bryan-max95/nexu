import { calculateFiscalTotals } from './fiscal-engine';
import type { PdfDocumentPayload, TemplateId } from './pdf-generator';

export function createDemoDocument(template: TemplateId = 'CORPORATIVA'): PdfDocumentPayload {
  const calc = calculateFiscalTotals({ items: [
    { id: 'demo-1', quantity: '1', description: 'Servicio profesional de ejemplo', unitPrice: '1000', discount: '0', taxTreatment: 'ISV_15' },
    { id: 'demo-2', quantity: '2', description: 'Producto de ejemplo', unitPrice: '250', discount: '0', taxTreatment: 'ISV_15' },
  ], taxIncluded: false, generalDiscount: '0', retencionAmount: '0', currency: 'HNL' });
  return {
    id: 'public-demo', docType: 'COTIZACION', docTypeLabel: 'Cotización de muestra', fiscalNumber: 'VISTA-PREVIA', status: 'BORRADOR',
    issueDateLocal: '2026-01-01', currency: 'HNL', paymentMethod: 'EFECTIVO', paymentCondition: 'Contado', templateUsed: template, templateVersion: 'DEMO', paperSize: 'LETTER',
    companySnapshot: { commercialName: 'Tu empresa', legalName: 'Empresa de ejemplo', rtn: '00000000000000', addressMatriz: 'Dirección comercial de ejemplo', addressEstablecimiento: 'Establecimiento de ejemplo', department: 'Francisco Morazán', municipality: 'Distrito Central', phone: '0000-0000', whatsapp: '', email: 'empresa@example.com', website: '', economicActivity: 'Actividad de ejemplo', representative: 'Responsable de ejemplo', modality: 'Demostración pública', primaryColor: '#7A1C24', secondaryColor: '#24262a', footerMessage: 'DOCUMENTO DE MUESTRA · SIN VALIDEZ FISCAL · bwpnexo.it.com' },
    clientSnapshot: { name: 'Cliente de ejemplo', rtn: '00000000000000', address: 'Dirección de ejemplo', isFinalConsumer: false }, items: calc.items, totals: calc,
  };
}
