import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { databaseRoute, consumeAuthAttempt } from '@/lib/database';
import { enforceRateLimit } from '@/lib/api-auth';
import { getDb, signSessionToken, verifyPassword, hashPassword } from '@/lib/server-store';
import { sendAccountMail } from '@/lib/mailer';
const digest = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
async function handlePOST(req: NextRequest) {
 if (!enforceRateLimit(`auth:${req.headers.get('x-forwarded-for') || 'local'}`,20)) return NextResponse.json({error:'Demasiados intentos. Espere un minuto.'},{status:429});
 const body=await req.json(); const db=getDb(); const action=String(body.action || 'LOGIN');
 if(!['LOGIN','VERIFY_EMAIL','RESET_PASSWORD','RESEND_VERIFICATION','RECOVER'].includes(action)) return NextResponse.json({error:'Acción no permitida.'},{status:400});
 const identity=String(body.email || body.token || body.verificationToken || '').trim().toLowerCase();
 if(!await consumeAuthAttempt(`${action}:${identity}`,action==='LOGIN'?20:6,900000)) return NextResponse.json({error:'Demasiados intentos para esta cuenta. Intente m?s tarde.'},{status:429});
 if(action==='VERIFY_EMAIL' || action==='RESET_PASSWORD') {
  const token=digest(String(body.verificationToken || body.token || ''));
  const user=db.users.find(u=> action==='VERIFY_EMAIL' ? u.verificationToken===token && Date.parse(u.verificationExpiresAt || '')>Date.now() : u.resetToken===token && Date.parse(u.resetExpiresAt || '')>Date.now());
  if(!user) return NextResponse.json({error:'Enlace inválido, vencido o ya utilizado.'},{status:422});
  if(action==='VERIFY_EMAIL') { user.emailVerified=true; delete user.verificationToken; delete user.verificationExpiresAt; }
  else { const password=String(body.password || ''); if(password.length<8) return NextResponse.json({error:'Use al menos 8 caracteres.'},{status:422}); const {hash,salt}=hashPassword(password); user.passwordHash=hash; user.passwordSalt=salt; user.emailVerified=true; db.sessions=db.sessions?.filter(s=>s.userId!==user.id); delete user.resetToken; delete user.resetExpiresAt; }
  return NextResponse.json({verified:true,message:'Operación completada. Ya puede iniciar sesión.'});
 }
 const email=String(body.email || '').trim().toLowerCase(); const user=db.users.find(u=>u.email.toLowerCase()===email);
 if(action==='RESEND_VERIFICATION' || action==='RECOVER') {
  if(user && !user.isSuperAdmin && (action==='RECOVER' || !user.emailVerified)) {
   const raw=crypto.randomBytes(32).toString('hex'); await sendAccountMail(email,raw,action==='RECOVER'?'reset':'verify');
   if(action==='RECOVER') {user.resetToken=digest(raw); user.resetExpiresAt=new Date(Date.now()+3600000).toISOString();}
   else {user.verificationToken=digest(raw); user.verificationExpiresAt=new Date(Date.now()+3600000).toISOString();}
  }
  return NextResponse.json({message:'Si la cuenta corresponde, recibirá un enlace por correo.'});
 }
 if(action!=='LOGIN') return NextResponse.json({error:'Acción no permitida.'},{status:400});
 const password=String(body.password || '');
 const valid=user && (user.id==='bwp-root' ? Boolean(process.env.ROOT_PASSWORD) && crypto.timingSafeEqual(Buffer.from(digest(password)),Buffer.from(digest(process.env.ROOT_PASSWORD || ''))) && email===process.env.ROOT_USERNAME?.toLowerCase() : verifyPassword(password,user.passwordHash,user.passwordSalt));
 if(!user || !valid) return NextResponse.json({error:'Usuario o contraseña incorrectos.'},{status:401});
 if(!user.emailVerified) return NextResponse.json({error:'Verifique su correo antes de entrar. Puede solicitar otro enlace.'},{status:403});
 const member=db.companyMembers.find(m=>m.userId===user.id && m.status==='ACTIVO');
 if(!user.isSuperAdmin && !member) return NextResponse.json({error:'No posee una empresa activa.'},{status:403});
 const company=db.companies.find(c=>c.id===member?.companyId);
 const sessionId=crypto.randomBytes(32).toString('hex');
 db.sessions=(db.sessions || []).filter(s=>s.expiresAt>Date.now());
 db.sessions.push({id:sessionId,userId:user.id,expiresAt:Date.now()+43200000});
 const token=signSessionToken({sessionId,userId:user.id,email:user.email,name:user.name,companyId:member?.companyId || '',role:member?.role || 'PROPIETARIO',isSuperAdmin:user.isSuperAdmin});
 const response=NextResponse.json({token:'',user:{id:user.id,name:user.name,email:user.email,emailVerified:true,role:member?.role || 'PROPIETARIO',isSuperAdmin:user.isSuperAdmin},company:company || {}});
 response.cookies.set('bwp_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:43200,path:'/'}); return response;
}
export const POST=databaseRoute(handlePOST);
export const GET=databaseRoute(async()=>{const c=getDb().systemConfig; return NextResponse.json({activationPriceHnl:c.activationPriceHnl,monthlyPriceHnl:c.monthlyPriceHnl,supportEmail:c.supportEmail});});
