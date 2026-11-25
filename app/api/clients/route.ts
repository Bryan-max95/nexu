import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { databaseRoute } from '@/lib/database';
import { requireCompanySession } from '@/lib/api-auth';
import { getDb } from '@/lib/server-store';
export const GET = databaseRoute(async (req: NextRequest) => {
  try { const { company } = requireCompanySession(req); return NextResponse.json({ clients: (getDb().clients || []).filter(c => c.companyId === company.id) }); }
  catch (err) { const e=err as {status?:number;message?:string}; return NextResponse.json({error:e.message},{status:e.status || 500}); }
});
export const POST = databaseRoute(async (req: NextRequest) => {
  try {
    const { company, member } = requireCompanySession(req);
    if (member.role === 'CONSULTA') return NextResponse.json({error:'No tiene permiso para editar clientes.'},{status:403});
    const body=await req.json();
    const name=String(body.name || '').trim(); const rtn=String(body.rtn || '').trim();
    if(!name || (rtn && !/^\d{14}$/.test(rtn))) return NextResponse.json({error:'Indique el nombre y un RTN válido de 14 dígitos, si corresponde.'},{status:422});
    const db=getDb(); db.clients ||= [];
    let client=db.clients.find(c=>c.companyId===company.id && (body.id ? c.id===body.id : rtn ? c.rtn===rtn : c.name===name));
    if(!client) {client={id:crypto.randomUUID(),companyId:company.id,name,rtn,address:'',whatsapp:'',email:''};db.clients.push(client);}
    Object.assign(client,{name,rtn,address:String(body.address || '').trim(),whatsapp:String(body.whatsapp || '').trim(),email:String(body.email || '').trim()});
    return NextResponse.json({client});
  } catch(err) {const e=err as {status?:number;message?:string};return NextResponse.json({error:e.message || 'No se pudo guardar.'},{status:e.status || 500});}
});
