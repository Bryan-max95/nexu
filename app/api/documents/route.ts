import { databaseRoute } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import { getDb } from '@/lib/server-store';

async function handleGET(req: NextRequest) {
  try {
    const { company } = requireCompanySession(req);
    const db = getDb();
    const { searchParams } = new URL(req.url);

    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const docType = searchParams.get('docType') || 'ALL';
    const status = searchParams.get('status') || 'ALL';
    const paymentMethod = searchParams.get('paymentMethod') || 'ALL';
    const cai = (searchParams.get('cai') || '').trim().toUpperCase();
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sortBy = searchParams.get('sortBy') || 'date_desc';
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(5, Number(searchParams.get('pageSize') || 20)));

    // Strict multi-tenant isolation: only documents belonging to company.id
    let docs = db.documents.filter((d) => d.companyId === company.id);

    // Collect distinct historical clients for quick auto-suggestion without forcing a catalog (Section 9.1)
    const clientSuggestionsMap = new Map<
      string,
      { name: string; rtn: string; address: string; whatsapp: string; email: string }
    >();
    for (const c of db.clients || []) { if (c.companyId === company.id) clientSuggestionsMap.set(c.rtn || c.name, c); }
    for (const d of docs) {
      if (d.clientName && d.clientName !== 'CONSUMIDOR FINAL') {
        const key = `${d.clientRtn || d.clientName}`;
        if (!clientSuggestionsMap.has(key)) {
          clientSuggestionsMap.set(key, {
            name: d.clientName,
            rtn: d.clientRtn,
            address: d.clientAddress,
            whatsapp: d.clientWhatsapp,
            email: d.clientEmail,
          });
        }
      }
    }

    if (search) {
      docs = docs.filter(
        (d) =>
          d.fiscalNumber.toLowerCase().includes(search) ||
          d.clientName.toLowerCase().includes(search) ||
          d.clientRtn.toLowerCase().includes(search) ||
          (d.caiCode && d.caiCode.toLowerCase().includes(search))
      );
    }

    if (docType !== 'ALL') {
      docs = docs.filter((d) => d.docType === docType);
    }

    if (status !== 'ALL') {
      docs = docs.filter((d) => d.status === status);
    }

    if (paymentMethod !== 'ALL') {
      docs = docs.filter((d) => d.paymentMethod === paymentMethod);
    }

    if (cai) {
      docs = docs.filter((d) => (d.caiCode || '').toUpperCase().includes(cai));
    }

    if (dateFrom) {
      docs = docs.filter((d) => d.issueDateLocal >= dateFrom);
    }

    if (dateTo) {
      docs = docs.filter((d) => d.issueDateLocal <= dateTo);
    }

    docs.sort((a, b) => {
      if (sortBy === 'number_asc') return a.fiscalNumber.localeCompare(b.fiscalNumber);
      if (sortBy === 'number_desc') return b.fiscalNumber.localeCompare(a.fiscalNumber);
      if (sortBy === 'date_asc') return a.createdAtUtc.localeCompare(b.createdAtUtc);
      return b.createdAtUtc.localeCompare(a.createdAtUtc);
    });

    // Calculate filtered total (separating fiscal emitted sales from non-fiscal receipts/quotes and annulled)
    let filteredFiscalTotal = 0;
    let filteredNonFiscalTotal = 0;

    for (const c of db.clients || []) { if (c.companyId === company.id) clientSuggestionsMap.set(c.rtn || c.name, c); }
    for (const d of docs) {
      if (d.status !== 'EMITIDO') continue;
      const amt = Number(d.totals.totalFiscal) || 0;
      if (d.docType === 'FACTURA' || d.docType === 'NOTA_DEBITO') {
        filteredFiscalTotal += amt;
      } else if (d.docType === 'NOTA_CREDITO') {
        filteredFiscalTotal -= amt;
      } else {
        filteredNonFiscalTotal += amt;
      }
    }

    const totalCount = docs.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const paginated = docs.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      documents: paginated,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      summary: {
        filteredFiscalTotal: filteredFiscalTotal.toFixed(2),
        filteredNonFiscalTotal: filteredNonFiscalTotal.toFixed(2),
      },
      clientSuggestions: Array.from(clientSuggestionsMap.values()),
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al consultar historial de documentos.' },
      { status: e.status || 500 }
    );
  }
}

export const GET = databaseRoute(handleGET);
