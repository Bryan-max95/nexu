'use client';
import { useState, useEffect } from 'react';
import EnterprisePortal from '@/components/EnterprisePortal';
import SuperAdminPanel from '@/components/SuperAdminPanel';
import { AuthenticatedPayload } from '@/components/AuthPortalView';
import { closeWorkspace } from '@/components/WorkspaceSessionGuard';
export default function Panel() {
  const [session,setSession]=useState<AuthenticatedPayload | null>(null);
  useEffect(()=>{fetch('/api/auth/session', {cache:'no-store'}).then(async r=>{if(!r.ok) {window.location.replace('/login');return;} setSession(await r.json());}).catch(()=>window.location.replace('/login'));},[]);
  if(!session) return <div className="p-12 text-center">Cargando tu espacio de trabajo…</div>;
  const user={...session.user,role:session.user.role as 'PROPIETARIO' | 'FACTURADOR' | 'CONSULTA'};
  return session.user.isSuperAdmin ? <SuperAdminPanel token={session.token} currentUser={user} onSwitchAccount={()=>{}} onLogout={closeWorkspace}/> : <EnterprisePortal token={session.token} currentUser={user} onSwitchAccount={()=>{}} onLogout={closeWorkspace}/>;
}
