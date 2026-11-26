'use client';

import { useEffect, useId, useState, FormEvent, InputHTMLAttributes } from 'react';
import Link from 'next/link';
import { BadgeCheck, Building2, Check, CheckCircle2, Eye, EyeOff, FileCheck2, FileText, Home, KeyRound, Loader2, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Mode = 'login' | 'register' | 'verify' | 'reset';

function BrandPanel({ mode }: { mode: Mode }) {
  const registering = mode === 'register';
  return <aside className="auth-brand-column hidden lg:block"><div className="auth-brand-inner">
    <div><p className="text-xs uppercase font-semibold tracking-[.18em] text-[#e8a5b2] mb-3">BWP NEXO · Portal empresarial</p><div className="flex items-center gap-2 text-xs text-white/40"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true"/>Tu empresa, en su propio espacio.</div></div>
    <div className="py-10 xl:py-14"><h2 className="font-display text-[clamp(2.3rem,3.3vw,3.5rem)] leading-[1.12] tracking-[-.045em] font-bold text-white mb-6">{registering ? <>Dale a tu empresa<br/>su próximo<br/><span className="text-[#edb0bc]">espacio de trabajo.</span></> : <>Tu negocio.<br/>Tu ritmo.<br/><span className="text-[#edb0bc]">Todo conectado.</span></>}</h2><p className="text-white/60 leading-relaxed max-w-sm">{registering ? 'Empieza con una cuenta verificada y prepara un lugar para tus clientes, tus documentos y tu equipo.' : 'Retoma tu operación con la información, los documentos y las herramientas que necesitas a mano.'}</p>
      {registering ? <ol className="space-y-6 mt-10">{[['Registra tu empresa','Completa los datos del responsable y la empresa.'],['Confirma tu correo','Recibe un enlace personal para verificar tu acceso.'],['Prepara tu operación','Configura tu empresa, equipo y autorizaciones.']].map(([title,text],index)=><li key={title} className="flex gap-4"><span className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-[#f0bcc6] text-sm font-semibold shrink-0">{index+1}</span><div><p className="font-semibold text-white text-sm mb-1">{title}</p><p className="text-xs text-white/45 leading-relaxed">{text}</p></div></li>)}</ol> : <div className="auth-brand-document mt-10" aria-label="Ilustración del espacio empresarial"><div className="flex justify-between items-center border-b border-white/10 pb-4 mb-1"><div><p className="text-white text-sm font-semibold">Tu empresa</p><p className="text-white/35 text-[11px] mt-1">Cada tarea, en su lugar.</p></div><span className="p-2.5 rounded-xl bg-white/10 text-[#e8acb9]"><Building2 className="w-5 h-5" aria-hidden="true"/></span></div>{[[FileText,'Documentos','Prepara, consulta y comparte'],[BadgeCheck,'Autorizaciones','Vigencia y correlativos'],[UserRound,'Tu equipo','Accesos según su responsabilidad']].map(([Icon,title,text])=>{const I=Icon as LucideIcon;return <div className="flex items-center gap-3 py-4 border-b last:border-0 border-white/[.06]" key={String(title)}><span className="text-[#d694a3]"><I className="w-4 h-4" aria-hidden="true"/></span><div><p className="text-white/85 text-xs font-semibold">{String(title)}</p><p className="text-white/35 text-[11px] mt-1">{String(text)}</p></div><Check className="ml-auto w-3.5 h-3.5 text-white/25" aria-hidden="true"/></div>;})}</div>}
    </div>
    <div className="mt-auto border-t border-white/10 pt-6 flex justify-between items-center gap-4"><div><p className="text-white/70 text-xs font-medium">Una empresa BWP</p><p className="text-white/30 text-[11px] mt-1">Tecnología para tu operación.</p></div><span className="text-white/40 text-xs">bwpnexo.it.com</span></div>
  </div></aside>;
}

export default function AuthExperience({ mode }: { mode: Mode }) {
  const formId=useId();
  const [hasToken,setHasToken]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [success,setSuccess]=useState(false);
  const [destination,setDestination]=useState('');
  const [visible,setVisible]=useState<Record<string,boolean>>({});
  useEffect(()=>setHasToken(Boolean(new URLSearchParams(window.location.search).get('token'))),[]);

  async function request(form: HTMLFormElement, action?: string) {
    if(action==='RESEND_VERIFICATION' && !String(new FormData(form).get('email') || '').trim()) {setSuccess(false);setMessage('Escribe tu correo para solicitar otro enlace de verificación.');return;}
    setBusy(true);setMessage('');setSuccess(false);
    const fields=Object.fromEntries(new FormData(form));
    const body=action==='RESEND_VERIFICATION'?{email:fields.email}:fields;
    const token=new URLSearchParams(window.location.search).get('token');
    try {
      const response=await fetch(mode==='register'?'/api/auth/register':'/api/auth/login',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...body,acceptTerms:fields.acceptTerms==='on',token,verificationToken:token,action:action||(mode==='verify'?'VERIFY_EMAIL':mode==='reset'?(token?'RESET_PASSWORD':'RECOVER'):'LOGIN')}),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'No se pudo completar la solicitud.');
      if(mode==='login'&&!action){form.reset();window.location.assign('/panel');return;}
      setDestination(String(fields.email||''));setMessage(data.message||'Correo verificado. Ya puedes iniciar sesión.');setSuccess(true);
    }catch(error){setMessage(error instanceof Error?error.message:'No se pudo conectar con el servidor. Intenta nuevamente.');}
    finally{setBusy(false);}
  }
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();await request(event.currentTarget);}

  const field=(name:string,label:string,Icon:LucideIcon,options:InputHTMLAttributes<HTMLInputElement>={},hint?:string)=>{
    const password=options.type==='password';
    return <div key={name} className="auth-field"><label htmlFor={`${formId}-${name}`} className="auth-field-label">{label}</label><span className="auth-input-wrap"><Icon className="auth-input-icon" aria-hidden="true"/><input {...options} id={`${formId}-${name}`} name={name} required aria-describedby={hint?`${formId}-${name}-hint`:undefined} disabled={busy} type={password&&visible[name]?'text':options.type||'text'} className={`auth-input ${password?'auth-password-input':''}`}/>{password&&<button type="button" aria-label={visible[name]?`Ocultar ${label.toLowerCase()}`:`Mostrar ${label.toLowerCase()}`} aria-pressed={!!visible[name]} onClick={()=>setVisible(previous=>({...previous,[name]:!previous[name]}))} className="auth-password-toggle">{visible[name]?<EyeOff className="w-[18px] h-[18px]"/>:<Eye className="w-[18px] h-[18px]"/>}</button>}</span>{hint&&<span id={`${formId}-${name}-hint`} className="auth-field-hint">{hint}</span>}</div>;
  };
  const registrationComplete=mode==='register'&&success;
  const actionComplete=success&&(mode==='verify'||(mode==='reset'&&hasToken));
  const recoverySent=success&&mode==='reset'&&!hasToken;
  const title=mode==='login'?'Bienvenido de nuevo.':mode==='register'?'Tu empresa comienza aquí.':mode==='verify'?'Confirma tu correo.':hasToken?'Una nueva contraseña.':'Recupera tu acceso.';
  const description=mode==='login'?'Ingresa a tu espacio de trabajo y continúa con tu operación.':mode==='register'?'Completa tus datos y recibe el enlace para verificar tu cuenta.':mode==='verify'?'Un último paso para confirmar la dirección de tu cuenta empresarial.':hasToken?'Elige una contraseña para volver a tu cuenta con seguridad.':'Te enviaremos un enlace personal para restablecer tu contraseña.';
  return <main className={`auth-page ${mode==='register'?'auth-register-page':''}`}>
    <div className="auth-topbar"><Link href="/" aria-label="BWP NEXO, volver al inicio" className="shrink-0"><img src="/logo-bwp-nexo.png" alt="BWP NEXO" className="w-40 sm:w-48 h-auto"/></Link><Link href="/" className="text-sm text-neutral-500 hover:text-[#7A1C24] flex items-center gap-2"><Home className="w-4 h-4" aria-hidden="true"/><span className="hidden sm:inline">Volver al sitio</span><span className="sm:hidden">Inicio</span></Link></div>
    <div className="auth-shell"><BrandPanel mode={mode}/><div className="auth-form-column">
      <div className="auth-form-topline"><span className="inline-flex items-center gap-1.5 text-xs text-neutral-400"><LockKeyhole className="w-3.5 h-3.5" aria-hidden="true"/>Portal de acceso</span><span className="text-xs text-neutral-500">{mode==='login'?<>¿Primera vez? <Link href="/registro" className="text-[#7A1C24] font-semibold ml-1">Crear cuenta</Link></>:<>¿Ya tienes cuenta? <Link href="/login" className="text-[#7A1C24] font-semibold ml-1">Iniciar sesión</Link></>}</span></div>
      <div className={`auth-form-content ${mode==='register'?'auth-registration-content':''}`}>
        {registrationComplete||actionComplete||recoverySent ? <div className="auth-success-view"><div className="auth-status-icon">{registrationComplete||recoverySent?<Mail className="w-8 h-8"/>:<CheckCircle2 className="w-8 h-8"/>}</div><p className="auth-eyebrow">{registrationComplete||recoverySent?'Revisa tu bandeja de entrada':'Todo listo para continuar'}</p><h1 className="auth-heading">{registrationComplete?'Tu siguiente paso está en tu correo.':recoverySent?'Un enlace para volver.':'Operación completada.'}</h1>{destination&&<p className="text-sm text-neutral-700 font-semibold rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 my-6 break-all">{destination}</p>}<p role="status" className="text-neutral-500 leading-relaxed mb-6">{message}</p>{(registrationComplete||recoverySent)&&<div className="auth-notice"><ShieldCheck className="w-5 h-5 shrink-0 text-[#7A1C24]"/><p>El enlace es personal, vence en una hora y solo puede utilizarse una vez. También puedes revisar la carpeta de correo no deseado.</p></div>}<Link href="/login" className="auth-submit mt-7">Ir a iniciar sesión</Link><Link href="/contacto" className="block text-center text-sm text-[#7A1C24] underline underline-offset-4 mt-5">Necesito ayuda con mi acceso</Link></div> : <>
          <div className="auth-heading-block"><div className="auth-heading-icon">{mode==='login'?<KeyRound className="w-6 h-6"/>:mode==='register'?<Building2 className="w-6 h-6"/>:mode==='verify'?<Mail className="w-6 h-6"/>:<LockKeyhole className="w-6 h-6"/>}</div><p className="auth-eyebrow">{mode==='register'?'Registro empresarial':mode==='login'?'Tu espacio de trabajo':'Seguridad de tu cuenta'}</p><h1 className="auth-heading">{title}</h1><p className="auth-description">{description}</p></div>
          <form onSubmit={submit} className="auth-form" aria-label={mode==='register'?'Registro empresarial':'Acceso a la cuenta'}>
            {mode==='register'?<>
              <section className="auth-form-section" aria-labelledby="responsible-title"><div className="auth-section-heading"><span>1</span><div><h2 id="responsible-title">Tu información de contacto</h2><p>La cuenta estará a nombre del responsable.</p></div></div><div className="auth-field-grid">{field('responsibleName','Nombre completo',UserRound,{placeholder:'Tu nombre y apellido',autoComplete:'name',maxLength:100})}{field('whatsapp','Teléfono / WhatsApp',Phone,{type:'tel',placeholder:'Tu número de contacto',autoComplete:'tel',maxLength:40})}</div>{field('email','Correo electrónico',Mail,{type:'email',placeholder:'nombre@empresa.com',autoComplete:'email',maxLength:254},'Usa un correo al que tengas acceso: recibirás el enlace de verificación.')}</section>
              <section className="auth-form-section" aria-labelledby="company-title"><div className="auth-section-heading"><span>2</span><div><h2 id="company-title">Los datos de tu empresa</h2><p>Prepara la información que identifica tu operación.</p></div></div>{field('commercialName','Nombre de la empresa',Building2,{placeholder:'Nombre comercial o razón social',autoComplete:'organization',maxLength:160})}{field('rtn','RTN de la empresa',BadgeCheck,{placeholder:'14 dígitos',pattern:'[0-9]{14}',maxLength:14,minLength:14,inputMode:'numeric'},'Conserva los ceros iniciales de tu RTN.')}<div className="auth-field-grid">{field('department','Departamento',MapPin,{placeholder:'Departamento',autoComplete:'address-level1',maxLength:100})}{field('municipality','Municipio',MapPin,{placeholder:'Municipio',autoComplete:'address-level2',maxLength:100})}</div>{field('addressMatriz','Dirección fiscal',MapPin,{placeholder:'Dirección principal de la empresa',autoComplete:'street-address',maxLength:300})}</section>
              <section className="auth-form-section" aria-labelledby="password-title"><div className="auth-section-heading"><span>3</span><div><h2 id="password-title">Protege tu acceso</h2><p>Elige una contraseña personal para tu cuenta.</p></div></div><div className="auth-field-grid">{field('password','Contraseña',LockKeyhole,{type:'password',placeholder:'Mínimo 8 caracteres',minLength:8,autoComplete:'new-password'})}{field('confirmPassword','Confirmar contraseña',LockKeyhole,{type:'password',placeholder:'Escríbela nuevamente',minLength:8,autoComplete:'new-password'})}</div><label className="auth-terms"><input type="checkbox" name="acceptTerms" required disabled={busy}/><span>Acepto los <Link href="/terminos">términos de uso y la información de privacidad</Link> de BWP NEXO.</span></label></section>
            </>:<>
              {mode!=='verify'&&!(mode==='reset'&&hasToken)&&field('email',mode==='login'?'Correo o usuario':'Correo electrónico',Mail,{type:mode==='login'?'text':'email',placeholder:mode==='login'?'Tu correo o nombre de usuario':'nombre@empresa.com',autoComplete:mode==='login'?'username':'email'})}
              {(mode==='login'||(mode==='reset'&&hasToken))&&field('password',mode==='reset'?'Nueva contraseña':'Contraseña',LockKeyhole,{type:'password',placeholder:mode==='reset'?'Mínimo 8 caracteres':'Tu contraseña',minLength:8,autoComplete:mode==='login'?'current-password':'new-password'})}
              {mode==='login'&&<div className="text-right -mt-1"><Link href="/recuperar" className="text-sm font-medium text-[#7A1C24] hover:underline underline-offset-4">¿Olvidaste tu contraseña?</Link></div>}
              {mode==='verify'&&<div className="auth-notice"><ShieldCheck className="w-5 h-5 shrink-0 text-[#7A1C24]"/><p>Confirma tu correo con el botón para continuar. El enlace vence en una hora y es de un solo uso.</p></div>}
            </>}
            {message&&<div role={success?'status':'alert'} className={`auth-feedback ${success?'auth-feedback-success':'auth-feedback-error'}`}>{success?<CheckCircle2 className="w-5 h-5 shrink-0"/>:<ShieldCheck className="w-5 h-5 shrink-0"/>}<p>{message}</p></div>}
            <button type="submit" disabled={busy} className="auth-submit">{busy?<><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true"/>Procesando…</>:mode==='login'?'Entrar a mi cuenta':mode==='register'?'Crear mi cuenta empresarial':mode==='verify'?'Confirmar mi correo':hasToken?'Guardar nueva contraseña':'Enviar enlace de recuperación'}</button>
            {mode==='login'&&<div className="auth-verification-help"><span className="text-neutral-500">¿Aún no confirmaste tu correo?</span><button disabled={busy} type="button" onClick={event=>{if(event.currentTarget.form)void request(event.currentTarget.form,'RESEND_VERIFICATION');}} className="font-semibold text-[#7A1C24] underline underline-offset-4 disabled:opacity-50">Reenviar enlace de verificación</button></div>}
          </form>
          {mode==='login'&&<div className="auth-register-invite"><span>Tu empresa todavía no tiene cuenta.</span><Link href="/registro">Comenzar mi registro</Link></div>}
          {mode!=='login'&&<Link href="/login" className="block text-center mt-6 text-sm text-neutral-500 hover:text-[#7A1C24]">Volver a iniciar sesión</Link>}
        </>}
      </div>
      <div className="auth-form-footer"><span className="inline-flex gap-2 items-center"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true"/>BWP NEXO · Una empresa BWP</span><Link href="/contacto">Ayuda y contacto</Link></div>
    </div></div>
    <div className="auth-bottom-bar"><span>© {new Date().getFullYear()} BWP NEXO</span><Link href="/terminos">Términos y privacidad</Link></div>
  </main>;
}
