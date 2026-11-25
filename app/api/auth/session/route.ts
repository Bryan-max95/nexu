import { NextRequest, NextResponse } from 'next/server';
import { databaseRoute } from '@/lib/database';
import { extractSessionFromRequest } from '@/lib/api-auth';
import { getDb } from '@/lib/server-store';
export const GET = databaseRoute(async (req: NextRequest) => {
  const session = extractSessionFromRequest(req);
  const db = getDb();
  const user = db.users.find(u => u.id === session?.userId && u.emailVerified);
  if (!session || !user) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
  const member = db.companyMembers.find(m => m.userId === user.id && m.companyId === session.companyId && m.status === 'ACTIVO');
  if (!user.isSuperAdmin && !member) return NextResponse.json({ error: 'Acceso revocado.' }, { status: 403 });
  return NextResponse.json({ token: '', user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, role: member?.role || session.role, isSuperAdmin: user.isSuperAdmin }, company: db.companies.find(c => c.id === session.companyId) || {} });
});
export const DELETE = databaseRoute(async (req: NextRequest) => {
  const session = extractSessionFromRequest(req);
  if (session) { const db = getDb(); db.sessions = db.sessions?.filter(s => s.id !== session.sessionId); }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('bwp_session','',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV === 'production',path:'/',maxAge:0}); return response;
});
