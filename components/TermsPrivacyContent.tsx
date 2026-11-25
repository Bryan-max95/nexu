import Link from 'next/link';
import { BadgeCheck, Building2, CircleHelp, Cookie, FileText, KeyRound, LockKeyhole, Mail, ShieldCheck, Users } from 'lucide-react';
import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import SecurityBrandSeal from './SecurityBrandSeal';
import TermsToolbar from './TermsToolbar';
import { OFFICIAL_APP_DOMAIN, OFFICIAL_APP_URL } from '@/lib/app-origin';

const sections = [
  { id:'alcance', label:'El servicio y su alcance', icon:Building2 },
  { id:'cuenta', label:'Tu cuenta y responsabilidades', icon:Users },
  { id:'documentos', label:'Uso de documentos y facturación', icon:FileText },
  { id:'datos', label:'Información que se registra', icon:LockKeyhole },
  { id:'finalidades', label:'Para qué se utiliza la información', icon:BadgeCheck },
  { id:'sesiones', label:'Sesiones y cookies', icon:Cookie },
  { id:'seguridad', label:'Seguridad y sello BWP', icon:ShieldCheck },
  { id:'compartir', label:'Entrega y enlaces de documentos', icon:Mail },
  { id:'conservacion', label:'Historial y revisión de datos', icon:FileText },
  { id:'contacto', label:'Consultas y contacto', icon:CircleHelp },
];

function PolicySection({ id, title, number, children }: { id:string; title:string; number:string; children:React.ReactNode }) {
  return <section id={id} className="terms-policy-section"><div className="flex items-start gap-4 mb-6"><span className="terms-section-number">{number}</span><h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#292c34] leading-snug">{title}</h2></div><div className="terms-policy-copy">{children}</div></section>;
}

export default function TermsPrivacyContent() {
  return <div className="marketing-root terms-page bg-[#f7f8fa] text-[#24262a]"><MarketingNav/><main>
    <section className="terms-hero"><div className="max-w-7xl mx-auto px-6 py-12 sm:py-16"><div className="text-sm text-neutral-500 flex gap-3 mb-10"><Link href="/">Inicio</Link><span aria-hidden="true">/</span><span>Términos y privacidad</span></div><div className="grid lg:grid-cols-[1.18fr_.82fr] gap-10 lg:gap-16 items-center">
      <div><p className="section-kicker">Confianza, información y responsabilidad</p><h1 className="font-display text-4xl sm:text-5xl xl:text-6xl font-bold tracking-[-.045em] leading-[1.12] mt-5 mb-7">Términos de uso<br/><span className="text-[#7A1C24]">y privacidad.</span></h1><p className="text-lg text-neutral-600 leading-relaxed max-w-xl">Conoce cómo funciona BWP NEXO, qué información se utiliza para prestar el servicio y cuáles son las responsabilidades de quienes acceden a una cuenta empresarial.</p><div className="flex flex-wrap gap-3 mt-7"><span className="inline-flex gap-2 items-center bg-white border border-neutral-200 rounded-full px-4 py-2 text-xs text-neutral-500"><FileText className="w-3.5 h-3.5" aria-hidden="true"/>Información actualizada: 25 de noviembre de 2026</span><a href={OFFICIAL_APP_URL} className="inline-flex gap-2 items-center bg-white border border-neutral-200 rounded-full px-4 py-2 text-xs text-[#7A1C24]"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true"/>{OFFICIAL_APP_DOMAIN}</a></div><div className="mt-8"><TermsToolbar/></div></div>
      <SecurityBrandSeal/>
    </div></div></section>

    <section aria-label="Controles de acceso a la plataforma" className="bg-white border-y border-neutral-200"><div className="max-w-7xl mx-auto px-6 grid sm:grid-cols-3 gap-7 py-7">{[
      {icon:Mail,title:'Correo verificado',text:'Confirmación antes del acceso empresarial.'},
      {icon:Users,title:'Permisos por rol',text:'Acceso según la membresía y responsabilidad.'},
      {icon:KeyRound,title:'Sesiones revocables',text:'Control del acceso al cerrar sesión o recuperar la cuenta.'},
    ].map(({icon:Icon,title,text})=><div key={title} className="flex gap-4 items-start"><span className="p-3 rounded-xl bg-[#7A1C24]/5 text-[#7A1C24]"><Icon className="w-5 h-5" aria-hidden="true"/></span><div><h2 className="text-sm font-semibold mb-2">{title}</h2><p className="text-sm text-neutral-500 leading-relaxed">{text}</p></div></div>)}</div></section>

    <div className="terms-layout max-w-7xl mx-auto px-6 py-12 sm:py-16 grid lg:grid-cols-[270px_1fr] gap-8 lg:gap-12 items-start">
      <aside className="terms-toc lg:sticky lg:top-28"><div className="rounded-2xl bg-white border border-neutral-200 p-6"><p className="text-xs font-semibold text-[#7A1C24] uppercase tracking-widest mb-5">En esta página</p><nav aria-label="Índice de términos y privacidad" className="space-y-1">{sections.map(({id,label,icon:Icon})=><a key={id} href={`#${id}`} className="flex items-start gap-3 py-2.5 text-sm text-neutral-500 hover:text-[#7A1C24] leading-relaxed"><Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true"/>{label}</a>)}</nav></div><div className="rounded-2xl border border-[#7A1C24]/15 bg-[#7A1C24]/[.035] p-6 mt-5"><CircleHelp className="w-6 h-6 text-[#7A1C24] mb-4"/><h2 className="font-semibold mb-3">¿Necesitas aclarar algo?</h2><p className="text-sm text-neutral-500 leading-relaxed mb-5">Puedes registrar una consulta para que BWP revise tu solicitud.</p><Link href="/contacto" className="text-sm text-[#7A1C24] font-semibold underline underline-offset-4">Contactar con BWP</Link></div></aside>
      <article className="terms-document bg-white border border-neutral-200 rounded-2xl px-6 sm:px-10 lg:px-12">
        <div className="py-8 sm:py-10 border-b border-neutral-200"><p className="text-xs text-neutral-400 font-medium uppercase tracking-widest mb-4">BWP NEXO · Información del servicio</p><h2 className="text-2xl font-bold tracking-tight mb-4">Un marco claro para trabajar juntos.</h2><p className="text-neutral-500 leading-relaxed">Esta página describe las condiciones de uso y el tratamiento de la información dentro de la plataforma. La creación de una cuenta requiere aceptar los términos y la información de privacidad del servicio.</p></div>

        <PolicySection id="alcance" number="01" title="El servicio y su alcance">
          <p>BWP NEXO es una plataforma del ecosistema BWP para administrar información empresarial, clientes, autorizaciones y documentos de facturación. Su sitio oficial es <a href={OFFICIAL_APP_URL}>{OFFICIAL_APP_DOMAIN}</a>.</p>
          <p>La disponibilidad de las acciones del panel depende del rol, los permisos, la membresía activa y el estado del servicio. La emisión fiscal requiere la configuración de la empresa, una autorización válida y la activación comercial correspondiente.</p>
          <p>La plataforma permite organizar la operación; la empresa usuaria es responsable de la exactitud de sus datos, de sus autorizaciones y de la información que incorpora en cada documento.</p>
        </PolicySection>
        <PolicySection id="cuenta" number="02" title="Tu cuenta y responsabilidades">
          <p>El registro utiliza el correo del responsable y los datos de la empresa. Antes de acceder, el usuario debe confirmar su correo mediante el enlace de verificación. Las invitaciones y la recuperación de cuenta también se gestionan por correo.</p>
          <ul><li>Utiliza una cuenta individual y una contraseña personal.</li><li>Mantén acceso al correo que registraste y revisa la información de contacto.</li><li>El propietario administra las membresías y los permisos del equipo.</li><li>Revoca los accesos que ya no correspondan y cierra sesión cuando termines de utilizar un dispositivo compartido.</li></ul>
          <p>Las cuentas no deben utilizarse para crear documentos falsos, suplantar a otras empresas ni intentar acceder a información que no corresponda al usuario.</p>
        </PolicySection>
        <PolicySection id="documentos" number="03" title="Uso de documentos y facturación">
          <p>La empresa usuaria debe revisar la información del cliente, los conceptos, importes, impuestos, condiciones y autorizaciones antes de confirmar una emisión. Guardar un borrador y emitir un documento son acciones distintas.</p>
          <p>Los documentos emitidos conservan una instantánea de sus datos. La anulación registra un motivo y mantiene la identificación del documento. Los archivos de muestra de la web pública contienen datos ilustrativos y no tienen validez fiscal.</p>
          <p>La activación y las mensualidades del servicio se administran desde el panel. El registro de un comprobante de pago no equivale a su aprobación; su estado se actualiza después de la revisión de BWP.</p>
        </PolicySection>
        <PolicySection id="datos" number="04" title="Información que se registra">
          <p>La información registrada depende del uso que hagas del servicio. Puede incluir:</p>
          <div className="terms-data-grid">{[
            ['Cuenta y contacto','Nombre, correo, teléfono, membresías, permisos y estado de verificación.'],
            ['Empresa y clientes','Razón social, nombre comercial, RTN, direcciones y datos de contacto utilizados en la operación.'],
            ['Documentos y autorizaciones','Conceptos, importes, estados, autorizaciones CAI, rangos, fechas y archivos de respaldo.'],
            ['Pagos y atención','Referencias, comprobantes, mensajes de consulta y registros de atención y actividad.'],
          ].map(([title,text])=><div key={title}><h3>{title}</h3><p>{text}</p></div>)}</div>
          <p>Las consultas del formulario público registran los datos de contacto, la empresa, el motivo y el mensaje. La identidad proporcionada en ese formulario se considera declarada y no equivale a una cuenta verificada.</p>
        </PolicySection>
        <PolicySection id="finalidades" number="05" title="Para qué se utiliza la información">
          <p>La información se utiliza para prestar y administrar el servicio: permitir el acceso, identificar la empresa, preparar y conservar documentos, gestionar permisos y suscripciones, atender consultas y registrar operaciones importantes.</p>
          <p>El correo se utiliza para verificar cuentas, facilitar la recuperación del acceso, enviar invitaciones y entregar los documentos cuyo envío solicita el usuario. Los datos de las consultas pueden utilizarse para revisar la solicitud y contactar a quien la presentó.</p>
          <p>La plataforma utiliza servicios de base de datos y correo para estas funciones. La administración accede a la información que necesita para gestionar el servicio y la atención, de acuerdo con sus responsabilidades.</p>
        </PolicySection>
        <PolicySection id="sesiones" number="06" title="Sesiones y cookies">
          <p>La plataforma utiliza una cookie de sesión para reconocer una cuenta autenticada. La cookie se configura con protección HttpOnly y SameSite; en producción se utiliza el atributo Secure.</p>
          <p>Las sesiones tienen una vigencia limitada y se registran para poder revocarlas. Cerrar sesión invalida el acceso correspondiente en el servidor. Restablecer la contraseña revoca las sesiones anteriores de la cuenta.</p>
          <p>Los enlaces de verificación y recuperación son personales, vencen en una hora y se utilizan una sola vez. Debes mantenerlos bajo tu control y evitar compartirlos con otras personas.</p>
        </PolicySection>
        <PolicySection id="seguridad" number="07" title="Seguridad y sello BWP Pentesting">
          <p>La plataforma incorpora controles de verificación de correo, permisos por rol, pertenencia a la empresa, sesiones revocables y entrega controlada de documentos. Las contraseñas de las cuentas de clientes se almacenan mediante hash y sal.</p>
          <p>BWP Pentesting forma parte del ecosistema de BWP y representa su identidad de ciberseguridad. El sello mostrado en esta página es una pieza de marca que permite identificar esa relación.</p>
          <div className="terms-scope-note"><ShieldCheck className="w-5 h-5 shrink-0 mt-1" aria-hidden="true"/><p>El sello no sustituye un informe técnico de auditoría ni una certificación independiente. La página de <Link href="/seguridad">seguridad</Link> describe el alcance de los controles implementados.</p></div>
          <p>Si tienes una consulta sobre acceso o manejo de información, utiliza el <Link href="/contacto?tema=SEGURIDAD">canal de consultas de seguridad</Link>. Comparte solo los datos necesarios y no envíes contraseñas.</p>
        </PolicySection>
        <PolicySection id="compartir" number="08" title="Entrega y enlaces de documentos">
          <p>El envío de un documento por correo requiere que el usuario confirme el destinatario. Antes de compartir información, revisa la dirección de correo y el archivo que deseas entregar.</p>
          <p>Los enlaces temporales permiten consultar un documento mientras están vigentes. Quien reciba el enlace podrá utilizarlo durante ese período; el usuario debe compartirlo únicamente con el destinatario correspondiente y puede revocarlo desde la plataforma.</p>
          <p>La apertura de WhatsApp o la generación de un enlace no confirma por sí sola que el cliente haya recibido o leído el documento.</p>
        </PolicySection>
        <PolicySection id="conservacion" number="09" title="Historial y revisión de datos">
          <p>La información se conserva para operar el servicio, mantener el historial documental y dar seguimiento a las acciones de la cuenta. La conservación de documentos fiscales también depende de las obligaciones que correspondan a la empresa usuaria.</p>
          <p>Para solicitar información, aclarar un dato o pedir la revisión de tu información, escribe a <a href="mailto:bwpsoporte@gmail.com">bwpsoporte@gmail.com</a>. Indica la empresa y el motivo de la solicitud. La atención puede requerir comprobar que la solicitud corresponde al titular o a una persona autorizada.</p>
          <p>Una solicitud de revisión no implica la eliminación inmediata de documentos emitidos ni de registros necesarios para el historial y las obligaciones de la operación.</p>
        </PolicySection>
        <PolicySection id="contacto" number="10" title="Consultas y contacto">
          <p>Si necesitas aclarar el funcionamiento del servicio, el uso de tus datos o el alcance de los controles, puedes registrar una consulta en el <Link href="/contacto">formulario empresarial</Link> o escribir al correo de soporte.</p>
          <p>El formulario guarda una referencia para que BWP revise la consulta. No incluyas contraseñas, tokens de acceso ni documentos confidenciales en el mensaje.</p>
          <div className="terms-contact-box"><Mail className="w-6 h-6 text-[#7A1C24] shrink-0" aria-hidden="true"/><div><h3>Contacto BWP</h3><a href="mailto:bwpsoporte@gmail.com">bwpsoporte@gmail.com</a></div><Link href="/contacto" className="terms-contact-action">Registrar una consulta</Link></div>
        </PolicySection>
        <div className="py-7 text-xs text-neutral-400 leading-relaxed border-t border-neutral-200">BWP NEXO · Una empresa BWP · {OFFICIAL_APP_DOMAIN}<br/>Información del servicio actualizada el 25 de noviembre de 2026.</div>
      </article>
    </div>
  </main><MarketingFooter/></div>;
}
