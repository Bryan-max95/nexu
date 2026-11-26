import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mock } from 'node:test';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { databaseRoute, consumeAuthAttempt } from '../lib/database';
import { getDb, hashPassword, signSessionToken, verifySessionToken } from '../lib/server-store';
import { POST as login } from '../app/api/auth/login/route';
import { POST as register } from '../app/api/auth/register/route';
import { GET as company } from '../app/api/company/route';
import { GET as admin, POST as review } from '../app/api/admin/payments/approve/route';
import { GET as getSubscription } from '../app/api/subscriptions/route';
import { POST as submitPayment } from '../app/api/subscriptions/payment/route';
import { DELETE as logout } from '../app/api/auth/session/route';
import { POST as clientSave, GET as clients } from '../app/api/clients/route';
import { POST as issue } from '../app/api/documents/issue/route';
import { GET as pdf } from '../app/api/documents/[id]/pdf/route';

async function main() {
mock.method(nodemailer,'createTransport',()=>({sendMail:async()=>({messageId:'integration-test'})}));
const uid=crypto.randomUUID();
const request=(body:unknown,token?:string)=>new NextRequest('http://localhost:3000/api/test',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
const read=(token?:string)=>new NextRequest('http://localhost:3000/api/test',{headers:token?{Authorization:`Bearer ${token}`}:{}});
const transaction=async(fn:()=>void)=>{const r=await databaseRoute(async()=>{fn();return NextResponse.json({ok:true});})();assert.equal(r.status,200);};
let companyId='', userId='', secondCompany='', rootSessionId='';
try {
 assert.equal((await company(new NextRequest('http://localhost:3000/api/company',{method:'POST',headers:{Origin:'https://untrusted.example'},body:'{}'}))).status,403);
 assert.equal((await company(new NextRequest('http://localhost:3000/api/company',{method:'POST',body:'x'.repeat(4*1024*1024+1)}))).status,413);
 const limited=databaseRoute(async()=>NextResponse.json({ok:true},{status:await consumeAuthAttempt(`qa-limit:${uid}`,1,60000)?200:429}));
 assert.equal((await limited()).status,200);assert.equal((await limited()).status,429);assert.equal((await limited()).status,429);
 assert.equal((await company(read())).status,401);
 assert.equal((await login(request({action:'DEMO_SWITCH',email:process.env.ROOT_USERNAME}))).status,400);
 assert.equal((await login(request({action:'SUPERADMIN_CLAIM',passcode:'anything'}))).status,400);
 assert.equal((await login(request({email:process.env.ROOT_USERNAME,password:'wrong'}))).status,401);
 const root=await login(request({email:process.env.ROOT_USERNAME,password:process.env.ROOT_PASSWORD}));assert.equal(root.status,200);
 const rootData=await root.json();rootData.token=decodeURIComponent(root.headers.get('set-cookie')!.split(';')[0].split('=')[1]);rootSessionId=verifySessionToken(rootData.token)!.sessionId!;assert(rootData.user.isSuperAdmin);assert(root.headers.get('set-cookie')?.includes('HttpOnly'));
 assert.equal((await admin(read(rootData.token))).status,200);
 const email=process.env.YOUR_EMAIL!.replace('@',`+qa${uid.slice(0,8)}@`);
 const registration=await register(request({responsibleName:'Prueba de integración',commercialName:`QA ${uid}`,rtn:'9999'+Date.now().toString().slice(-10),email,whatsapp:'99999999',password:'Integration-test-123',confirmPassword:'Integration-test-123',acceptTerms:true,addressMatriz:'Dirección de prueba'}));
 assert.equal(registration.status,201);const registered=await registration.json();assert.equal(registered.token,undefined);assert.equal(registered.verificationToken,undefined);
 const raw=crypto.randomBytes(32).toString('hex');
 await transaction(()=>{const db=getDb();const u=db.users.find(u=>u.email===email)!;assert(u);userId=u.id;companyId=db.companyMembers.find(m=>m.userId===u.id)!.companyId;u.verificationToken=crypto.createHash('sha256').update(raw).digest('hex');u.verificationExpiresAt=new Date(Date.now()+60000).toISOString();});
 assert.equal((await login(request({email,password:'Integration-test-123'}))).status,403);
 assert.equal((await login(request({action:'VERIFY_EMAIL',token:raw}))).status,200);
 assert.equal((await login(request({action:'VERIFY_EMAIL',token:raw}))).status,422);
 const account=await login(request({email,password:'Integration-test-123'}));assert.equal(account.status,200);const accountData=await account.json();assert.equal(accountData.token,'');const token=decodeURIComponent(account.headers.get('set-cookie')!.split(';')[0].split('=')[1]);
 assert.equal((await company(read(token))).status,200);assert.equal((await admin(read(token))).status,403);
 const readSubscription = async () => {
   const response = await getSubscription(read(token));
   assert.equal(response.status, 200);
   return response.json();
 };
 const submit = (paymentType: string, ref: string) => submitPayment(request({
   paymentType, bankReference: `${uid}-${ref}`, receiptFilename: 'transferencia.pdf',
   receiptDataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
 }, token));
 const reviewReceipt = (paymentId: string, decision: string) => review(request({
   action: 'REVIEW_PAYMENT', paymentId, decision, rejectionReason: 'Referencia incorrecta',
 }, rootData.token));
 assert.equal((await readSubscription()).charge.paymentType, 'ACTIVACION_UNICA');
 assert.equal((await submit('MENSUALIDAD', 'prematuro')).status, 409);
 const activationRequests = await Promise.all([submit('ACTIVACION_UNICA', 'act-a'), submit('ACTIVACION_UNICA', 'act-b')]);
 assert.deepEqual(activationRequests.map(r => r.status).sort(), [200, 409]);
 const firstReceipt = (await activationRequests.find(r => r.ok)!.json()).payment;
 assert.equal((await readSubscription()).charge.pendingReference, firstReceipt.bankReference);
 assert.equal((await reviewReceipt(firstReceipt.id, 'RECHAZAR')).status, 200);
 assert.equal((await readSubscription()).charge.pendingReference, null);
 const activation = (await (await submit('ACTIVACION_UNICA', 'act-corregida')).json()).payment;
 const legacyId = `legacy-duplicate-${uid}`;
 await transaction(() => {
   getDb().subscriptionPayments.push({ ...activation, id: legacyId, bankReference: legacyId });
 });
 assert.equal((await reviewReceipt(activation.id, 'APROBAR')).status, 200);
 const activated = await readSubscription();
 assert.deepEqual(activated.charge, { paymentType: 'MENSUALIDAD', amountHnl: activated.pricing.monthlyPriceHnl, pendingReference: null });
 assert(activated.payments.some((p: { id: string; status: string }) => p.id === activation.id && p.status === 'APROBADO'));
 assert.equal((await reviewReceipt(activation.id, 'APROBAR')).status, 409);
 assert.equal((await reviewReceipt(legacyId, 'APROBAR')).status, 409);
 assert.equal((await submit('ACTIVACION_UNICA', 'repetida')).status, 409);
 const monthly = (await (await submit('MENSUALIDAD', 'mes-1')).json()).payment;
 assert.equal(monthly.amountHnl, activated.pricing.monthlyPriceHnl);
 assert.equal((await submit('MENSUALIDAD', 'duplicado')).status, 409);
 assert.equal((await reviewReceipt(monthly.id, 'APROBAR')).status, 200);
 const renewedSubscription = await readSubscription();
 assert(renewedSubscription.subscription.nextPaymentDate > activated.subscription.nextPaymentDate);
 assert.equal(renewedSubscription.charge.paymentType, 'MENSUALIDAD');
 const savedClient=await clientSave(request({name:'Cliente QA',rtn:'99999999999999'},token));assert.equal(savedClient.status,200,await savedClient.text());
 const list=await (await clients(read(token))).json();assert.equal(list.clients.length,1);
 await transaction(()=>{const db=getDb();const c=db.companies.find(c=>c.id===companyId)!;secondCompany=`qa-${uid}`;db.companies.push({...c,id:secondCompany});db.clients.push({id:uid,companyId:secondCompany,name:'PRIVATE OTHER COMPANY',rtn:'',address:'',whatsapp:'',email:''});const sub=db.subscriptions.find(s=>s.companyId===companyId)!;sub.activationPaid=true;sub.status='ACTIVA';sub.nextPaymentDate='2099-01-01';});
 assert.equal((await (await clients(read(token))).json()).clients.length,1);
 const body={docType:'COTIZACION',clientName:'Cliente QA',clientRtn:'99999999999999',items:[{id:'1',description:'Servicio de prueba',quantity:'1',unitPrice:'100',discount:'0',taxTreatment:'ISV_15'}],idempotencyKey:uid};
 const results=await Promise.all([issue(request(body,token)),issue(request(body,token))]);assert(results.every(r=>r.status===200));const docs=await Promise.all(results.map(r=>r.json()));assert.equal(docs[0].document.id,docs[1].document.id);
 const response=await pdf(read(token),{params:Promise.resolve({id:docs[0].document.id})});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');
 const resetToken=crypto.randomBytes(32).toString('hex');
 await transaction(()=>{const u=getDb().users.find(u=>u.id===userId)!;u.resetToken=crypto.createHash('sha256').update(resetToken).digest('hex');u.resetExpiresAt=new Date(Date.now()+60000).toISOString();});
 assert.equal((await login(request({action:'RESET_PASSWORD',token:resetToken,password:'Integration-new-pass-123'}))).status,200);
 assert.equal((await company(read(token))).status,401);
 const renewed=await login(request({email,password:'Integration-new-pass-123'}));assert.equal(renewed.status,200);
 const renewedToken=decodeURIComponent(renewed.headers.get('set-cookie')!.split(';')[0].split('=')[1]);
 assert.equal((await logout(new NextRequest('http://localhost:3000/api/auth/session',{method:'DELETE',headers:{Authorization:`Bearer ${renewedToken}`}}))).status,200);
 assert.equal((await company(read(renewedToken))).status,401);
 console.log('Seguridad OK: limites persistentes, origen, tamano y revocacion tras reset/logout.');
 console.log('Integración con Neon OK: registro (SMTP simulado), verificación de un uso, login root/cliente, permisos, clientes, emisión concurrente idempotente y PDF.');
} finally {
 await transaction(()=>{const db=getDb();const ids=[companyId,secondCompany].filter(Boolean);for(const key of ['companies','companyMembers','clients','documents','subscriptions','subscriptionPayments','notifications','auditLogs','shareLinks','integrationSettings','integrationEvents','idempotencyKeys','supportTickets','fiscalAuthorizations'] as const){(db as any)[key]=(db[key] as any[]).filter(r=>!ids.includes(r.companyId) && !ids.includes(r.id));}db.users=db.users.filter(u=>u.id!==userId);db.sessions=db.sessions?.filter(s=>s.userId!==userId && s.id!==rootSessionId);for(const id of ids)delete db.internalSequences[id];});
}
}
main().then(()=>process.exit(0)).catch(err=>{console.error(err instanceof Error ? err.stack : 'Integración fallida');process.exit(1);});
