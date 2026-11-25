import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { calculateFiscalTotals } from '../lib/fiscal-engine';
import { generateServerPdf, PdfDocumentPayload } from '../lib/pdf-generator';
import { databaseContext, createInitialState, hashPassword, verifyPassword, signSessionToken, verifySessionToken } from '../lib/server-store';
import { validateAttachment } from '../lib/attachments';
import { resolveAppOrigin, OFFICIAL_APP_URL } from '../lib/app-origin';
import { validateContactRequest } from '../lib/contact-request';

test('public business inquiries require consent and bounded valid contact details',()=>{
 const valid={name:'Responsable de prueba',company:'Empresa de prueba',email:'contact@example.test',phone:'12345678',topic:'COMERCIAL',message:'Necesito conocer las capacidades del sistema para mi empresa.',consent:true};
 assert.equal(validateContactRequest(valid).topic,'COMERCIAL');
 for(const overrides of [{consent:false},{consent:'true'},{email:'invalid'},{message:'Corto'},{message:'x'.repeat(2501)},{topic:'ADMIN'},{name:{unsafe:'data'}}]) assert.throws(()=>validateContactRequest({...valid,...overrides}));
});

test('production links always use the official HTTPS domain while development stays local',()=>{
 for(const configured of [undefined,'http://localhost:3001','https://untrusted.example','https://bwpnexo.it.com.evil.example','https://bwpnexo.it.com:8443']) {
  assert.equal(resolveAppOrigin('production',configured),OFFICIAL_APP_URL);
 }
 assert.equal(resolveAppOrigin('development','http://localhost:3001'),'http://localhost:3001');
 assert.equal(resolveAppOrigin('test','http://127.0.0.1:3000'),'http://127.0.0.1:3000');
 assert.equal(resolveAppOrigin('development','https://bwpnexo.it.com/'),OFFICIAL_APP_URL);
 assert.throws(()=>resolveAppOrigin('development','https://untrusted.example'));
 assert.throws(()=>resolveAppOrigin('development','https://attacker@bwpnexo.it.com'));
});

test('passwords are salted and tampered/expired sessions are rejected',()=>{
 const a=hashPassword('example-pass'); const b=hashPassword('example-pass');
 assert.notEqual(a.hash,b.hash); assert(verifyPassword('example-pass',a.hash,a.salt)); assert(!verifyPassword('wrong',a.hash,a.salt));
 const token=signSessionToken({userId:'u',email:'u@example.test',name:'U',companyId:'c',role:'CONSULTA',isSuperAdmin:false});
 assert(verifySessionToken(token)); assert.equal(verifySessionToken(token+'x'),null);
 const original=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
 for(const exp of [Date.now()-1000,null,'invalid']) {
  const data=Buffer.from(JSON.stringify({...original,exp})).toString('base64url');
  const key=process.env.SESSION_SECRET ? Buffer.from(process.env.SESSION_SECRET) : global._bwpSessionSecret!;
  const signature=crypto.createHmac('sha256',key).update(data).digest('base64url');
  assert.equal(verifySessionToken(`${data}.${signature}`),null);
 }
});
test('request contexts isolate company data',async()=>{
 const a=createInitialState(),b=createInitialState();
 await Promise.all([databaseContext.run(a,async()=>{await new Promise(r=>setTimeout(r,5)); assert.equal(databaseContext.getStore(),a);}),databaseContext.run(b,async()=>assert.equal(databaseContext.getStore(),b))]);
});
test('PDF paginates long descriptions without losing text and produces valid offsets',()=>{
 const calc=calculateFiscalTotals({items:Array.from({length:50},(_,i)=>({id:String(i),quantity:'1',description:`CONCEPTO_${i} `+'Descripción extensa de servicio profesional '.repeat(i===0?80:3),unitPrice:'100',discount:'0',taxTreatment:'ISV_15' as const})),taxIncluded:false,generalDiscount:'0',retencionAmount:'0',currency:'HNL'});
 assert.equal(calc.totalFiscal,'5750.00');
 for(const paperSize of ['LETTER','A4'] as const) for(const templateUsed of ['CLASICA','CORPORATIVA','MINIMALISTA'] as const) {
 const payload:PdfDocumentPayload={id:'test',docType:'FACTURA',docTypeLabel:'Factura',fiscalNumber:'000-001-01-00000001',status:'EMITIDO',issueDateLocal:'2026-11-25',currency:'HNL',paymentMethod:'EFECTIVO',paymentCondition:'Contado',templateUsed,templateVersion:'2',paperSize,companySnapshot:{legalName:'Empresa de prueba con nombre legal extenso',commercialName:'Empresa de prueba',rtn:'08019000000001',addressMatriz:'Dirección de prueba',addressEstablecimiento:'000',department:'Francisco Morazán',municipality:'Distrito Central',phone:'12345678',whatsapp:'',email:'test@example.test',economicActivity:'Servicios',representative:'Prueba',modality:'Autoimpresor',primaryColor:'#7A1C24',secondaryColor:'#24262a',footerMessage:'Original: Cliente'},clientSnapshot:{name:'Cliente de prueba',rtn:'08019000000002',isFinalConsumer:false},items:calc.items,totals:calc};
 const pdf=generateServerPdf(payload); const raw=pdf.buffer.toString('latin1');
 assert(pdf.pageCount>1); for(let i=0;i<50;i++) assert(raw.includes(`CONCEPTO_${i}`));
 assert(raw.startsWith('%PDF-1.4')); assert(raw.endsWith('%%EOF'));
 const xref=Number(/startxref\n(\d+)/.exec(raw)?.[1]); assert.equal(raw.slice(xref,xref+4),'xref');
 assert.equal(pdf.sha256Hash.length,64);
 }
});
test('attachments reject disguised and oversized content',()=>{
 assert.throws(()=>validateAttachment('data:application/pdf;base64,SGVsbG8='));
 assert.throws(()=>validateAttachment('x'.repeat(2_800_001)));
 assert(validateAttachment('data:application/pdf;base64,JVBERi0xLjQ='));
});
