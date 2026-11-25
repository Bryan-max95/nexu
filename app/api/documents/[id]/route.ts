import { databaseRoute } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import { getDb } from '@/lib/server-store';

async function handleGET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { company } = requireCompanySession(req);
    const { id } = await context.params;
    const db = getDb();

    // Enforce row-level multi-company isolation (Section 24 & 26)
    const doc = db.documents.find((d) => d.id === id);
    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }
    if (doc.companyId !== company.id) {
      return NextResponse.json(
        { error: 'Acceso cruzado denegado (403): Este documento pertenece a otra empresa.' },
        { status: 403 }
      );
    }

    const shareLinks = db.shareLinks.filter(
      (s) => s.companyId === company.id && s.documentId === doc.id
    );
    const auditHistory = db.auditLogs.filter(
      (a) => a.companyId === company.id && a.entityId === doc.id
    );

    return NextResponse.json({
      document: doc,
      shareLinks,
      auditHistory,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al consultar documento.' },
      { status: e.status || 500 }
    );
  }
}

export const GET = databaseRoute(handleGET);
