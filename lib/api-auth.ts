import { NextRequest } from 'next/server';
import {
  CompanyMemberRecord,
  CompanyRecord,
  getDb,
  SessionTokenPayload,
  verifySessionToken,
} from './server-store';

declare global {
  var _bwpRateLimitMap: Map<string, { count: number; resetAt: number }> | undefined;
}

export function enforceRateLimit(key: string, maxRequests = 90, windowMs = 60_000): boolean {
  if (!global._bwpRateLimitMap) {
    global._bwpRateLimitMap = new Map();
  }
  const now = Date.now();
  const entry = global._bwpRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    global._bwpRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function extractSessionFromRequest(req: NextRequest): SessionTokenPayload | null {
  const authHeader = req.headers.get('authorization');
  const token = req.cookies.get('bwp_session')?.value || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined);
  const session = verifySessionToken(token);
  if (!session?.sessionId) return null;
  const active = getDb().sessions?.some(s => s.id === session.sessionId && s.userId === session.userId && s.expiresAt > Date.now());
  return active ? session : null;
}

export function requireCompanySession(req: NextRequest): {
  session: SessionTokenPayload;
  company: CompanyRecord;
  member: CompanyMemberRecord;
} {
  const session = extractSessionFromRequest(req);
  if (!session) {
    throw { status: 401, message: 'No autenticado (401): Token de sesión ausente o expirado.' };
  }
  const db = getDb();
  const user = db.users.find(u => u.id === session.userId);
  if (!user?.emailVerified || user.isSuperAdmin) throw { status: 403, message: 'Debe verificar su cuenta de cliente.' };
  // Server derives company_id strictly from authorized active membership (Section 24 & 26)
  const member = db.companyMembers.find(
    (m) => m.userId === session.userId && m.companyId === session.companyId && m.status === 'ACTIVO'
  );
  if (!member) {
    throw {
      status: 403,
      message: 'Acceso denegado (403): No posee membresía activa en la empresa solicitada.',
    };
  }
  const company = db.companies.find((c) => c.id === member.companyId);
  if (!company) {
    throw { status: 404, message: 'Empresa no encontrada.' };
  }
  return { session, company, member };
}

export function requireSuperAdminSession(req: NextRequest): SessionTokenPayload {
  const session = extractSessionFromRequest(req);
  if (!session) {
    throw { status: 401, message: 'No autenticado (401): Sesión requerida.' };
  }
  const db = getDb();
  const user = db.users.find((u) => u.id === session.userId);
  if (!user || !user.isSuperAdmin || !session.isSuperAdmin) {
    throw {
      status: 403,
      message: 'Acceso denegado (403): Se requieren privilegios de Superadministrador BWP.',
    };
  }
  return session;
}
