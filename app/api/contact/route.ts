import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { databaseRoute, consumeAuthAttempt } from '@/lib/database';
import { validateContactRequest } from '@/lib/contact-request';
import { appendAuditLog, getDb } from '@/lib/server-store';

export const POST=databaseRoute(async(req:NextRequest)=>{
  try {
    const raw=await req.json();
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) return NextResponse.json({error:'Solicitud inválida.'},{status:422});
    const request=validateContactRequest(raw);
    if(!await consumeAuthAttempt(`contact:${request.email}`,3,900000)||!await consumeAuthAttempt('contact:global',50,60000)) return NextResponse.json({error:'Se alcanzó el límite de consultas. Intenta más tarde o escribe a bwpsoporte@gmail.com.'},{status:429});
    const id=`BWP-CON-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    getDb().supportTickets.unshift({
      id, companyId:'public-contact', companyName:request.company, subject:`Consulta pública · ${request.topicLabel}`,
      message:`Origen: formulario público (correo no verificado).\nContacto: ${request.name}\nCorreo: ${request.email}\nTeléfono: ${request.phone||'No indicado'}\n\n${request.message}`,
      status:'ABIERTO', createdAtUtc:new Date().toISOString(),
    });
    appendAuditLog({companyId:null,actorId:'public-contact',actorName:request.name,actorRole:'VISITANTE',operation:'CONSULTA_PUBLICA_RECIBIDA',entityType:'support_ticket',entityId:id,details:`Consulta pública recibida: ${request.topicLabel}. Identidad declarada por el visitante, no verificada.`});
    return NextResponse.json({reference:id,message:'Tu consulta quedó registrada para revisión por BWP. Conserva esta referencia.'},{status:201});
  } catch(error) {
    if(error instanceof SyntaxError) return NextResponse.json({error:'El contenido de la solicitud no es válido.'},{status:400});
    const detail=error as {status?:number;message?:string};
    return NextResponse.json({error:detail.status===422?detail.message:'No se pudo registrar tu consulta. Intenta nuevamente.'},{status:detail.status===422?422:500});
  }
});
