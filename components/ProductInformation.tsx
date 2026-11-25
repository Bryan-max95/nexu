import Link from 'next/link';
import { Check, FileText, FolderOpen, LayoutDashboard, Users, Palette, CreditCard, ShieldCheck, Send, ClipboardList, Building2 } from 'lucide-react';

const modules = [
  { icon: LayoutDashboard, name: 'Inicio', description: 'Una vista de tu actividad, tus documentos recientes y los avisos que requieren atención.', features: ['Resumen de documentos y montos', 'Avisos de CAI y suscripción', 'Acceso a las tareas de cada día'] },
  { icon: FileText, name: 'Crear documento', description: 'Prepara cada operación con los datos del cliente, el detalle de conceptos y sus impuestos.', features: ['Facturas, recibos y cotizaciones', 'Notas de crédito y de débito vinculadas', 'Borradores antes de la emisión'] },
  { icon: FolderOpen, name: 'Documentos emitidos', description: 'Encuentra lo que necesitas sin revisar archivos dispersos ni repetir el trabajo.', features: ['Búsqueda por cliente, RTN o número', 'Filtros por fecha, tipo, estado y pago', 'PDF, impresión y exportación de reportes'] },
  { icon: ShieldCheck, name: 'CAI y correlativos', description: 'Mantén identificadas las autorizaciones que utiliza tu empresa para sus documentos fiscales.', features: ['Rangos y puntos de emisión', 'Fechas límite y números disponibles', 'Respaldo de la autorización e historial'] },
  { icon: Building2, name: 'Mi empresa', description: 'Organiza tu información fiscal y comercial y administra el acceso de tus colaboradores.', features: ['Razón social, RTN y direcciones', 'Directorio de clientes reutilizable', 'Miembros, permisos y actividad registrada'] },
  { icon: Palette, name: 'Plantillas', description: 'Cuida la presentación de tus documentos con opciones acordes a la identidad de tu empresa.', features: ['Clásica, corporativa y minimalista', 'Colores, pie de página y datos comerciales', 'Formatos de impresión Carta y A4'] },
  { icon: CreditCard, name: 'Mi suscripción', description: 'Consulta el estado del servicio y da seguimiento a tus pagos desde tu propia cuenta.', features: ['Activación y mensualidades', 'Carga del comprobante bancario', 'Historial y estado de revisión del pago'] },
];

export function ProductInformation() {
  return <>
    <section className="bg-[#f1f1f3] border-b border-neutral-200 py-16">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1fr_1.2fr] gap-10 items-center">
        <div><p className="text-[#7A1C24] uppercase tracking-widest text-sm font-bold">Pensado para tu operación</p><h2 className="text-3xl font-bold tracking-tight mt-4 mb-5">De los datos del cliente<br/>al documento que entregas.</h2><p className="text-neutral-600 leading-relaxed">BWP NEXO reúne el trabajo de facturación de profesionales, prestadores de servicios y empresas comerciales que necesitan preparar documentos con claridad y conservar su historial.</p></div>
        <div className="grid sm:grid-cols-2 gap-4">{[
          ['Para quien factura', 'Reutiliza los datos de tus clientes, detalla productos o servicios y revisa los totales antes de emitir.'],
          ['Para quien administra', 'Configura la empresa, registra sus autorizaciones y distribuye responsabilidades entre los miembros del equipo.'],
          ['Para quien consulta', 'Localiza documentos y consulta información para dar seguimiento a la operación, según los permisos asignados.'],
          ['Para tu cliente', 'Entrega un PDF con conceptos, impuestos y totales legibles, listo para imprimir o compartir.'],
        ].map(([title, description]) => <article key={title} className="bg-white rounded-xl border border-neutral-200 p-6"><h3 className="font-bold mb-2">{title}</h3><p className="text-sm text-neutral-600 leading-relaxed">{description}</p></article>)}</div>
      </div>
    </section>

    <section id="modulos" aria-labelledby="modules-title" className="max-w-7xl mx-auto px-6 py-20">
      <div className="max-w-3xl mb-12"><p className="text-[#7A1C24] text-sm font-bold tracking-widest uppercase">Conoce tu panel empresarial</p><h2 id="modules-title" className="text-3xl sm:text-4xl font-bold tracking-tight mt-4 mb-5">Siete módulos para trabajar con orden.</h2><p className="text-lg text-neutral-600 leading-relaxed">Cada tarea tiene su lugar: preparar una factura, consultar un documento anterior, renovar un CAI o revisar la suscripción. Tu equipo encuentra las herramientas de acuerdo con su rol.</p></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{modules.map(({ icon: Icon, name, description, features }) => <article key={name} className="bg-white border border-neutral-200 rounded-2xl p-7 flex flex-col">
        <Icon className="w-7 h-7 text-[#7A1C24] mb-5" aria-hidden="true"/><h3 className="text-xl font-bold mb-3">{name}</h3><p className="text-neutral-600 leading-relaxed mb-6">{description}</p><ul className="space-y-3 mt-auto">{features.map(feature => <li key={feature} className="flex gap-3 text-sm text-neutral-700 leading-relaxed"><Check className="w-4 h-4 text-[#7A1C24] mt-1 shrink-0" aria-hidden="true"/>{feature}</li>)}</ul>
      </article>)}</div>
    </section>

    <section id="documentos" className="bg-white border-y border-neutral-200 py-20"><div className="max-w-7xl mx-auto px-6">
      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <div><p className="text-[#7A1C24] text-sm font-bold uppercase tracking-widest">Documentos y presentación</p><h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4 mb-6">La información completa.<br/>Una entrega profesional.</h2><p className="text-neutral-600 leading-relaxed mb-7">Prepara documentos con el detalle de tu operación: cliente, RTN, dirección, moneda, forma de pago, conceptos, descuentos e impuestos. Las facturas conservan la información de la empresa y la autorización utilizada al momento de su emisión.</p>
          <div className="flex flex-wrap gap-2">{['Factura', 'Nota de crédito', 'Nota de débito', 'Recibo', 'Cotización'].map(label => <span key={label} className="border border-[#7A1C24]/20 bg-[#7A1C24]/5 rounded-lg px-4 py-2 text-sm text-[#7A1C24] font-semibold">{label}</span>)}</div>
          <p className="text-sm text-neutral-500 leading-relaxed mt-6">La emisión de documentos fiscales utiliza un CAI vigente y un rango disponible. Los recibos y las cotizaciones se identifican como documentos no fiscales.</p>
        </div>
        <div className="border border-neutral-200 rounded-2xl overflow-hidden">
          {[
            [ClipboardList, 'Cálculo detallado', 'Desglose de bases, descuentos, ISV al 15 % y 18 %, exentos, exonerados y alícuota cero, según los conceptos de la operación.'],
            [Palette, 'Tres estilos de documento', 'Elige una presentación clásica, corporativa o minimalista y configura colores y mensajes de tu empresa.'],
            [FileText, 'PDF listo para entregar', 'Carta o A4, descripciones extensas con continuación entre páginas y un resumen de importes fácil de revisar.'],
            [Send, 'Entrega y seguimiento', 'Descarga, imprime o envía el PDF por correo. También puedes generar un enlace temporal para compartir por WhatsApp y revocarlo cuando lo necesites.'],
          ].map(([Icon, title, description], index) => { const I = Icon as typeof FileText; return <article key={String(title)} className={`p-6 flex gap-4 ${index ? 'border-t border-neutral-200' : ''}`}><I className="w-6 h-6 shrink-0 text-[#7A1C24] mt-1" aria-hidden="true"/><div><h3 className="font-bold mb-2">{String(title)}</h3><p className="text-sm text-neutral-600 leading-relaxed">{String(description)}</p></div></article>; })}
        </div>
      </div>
    </div></section>

    <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-[.9fr_1.1fr] gap-12 items-center">
      <div><Users className="w-8 h-8 text-[#7A1C24] mb-6" aria-hidden="true"/><p className="text-[#7A1C24] text-sm uppercase tracking-widest font-bold">Tu equipo, con su propio acceso</p><h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4 mb-5">Responsabilidades claras.<br/>Información de tu empresa.</h2><p className="text-neutral-600 leading-relaxed">Invita a tus colaboradores con sus propios correos y asigna el nivel de acceso que corresponde a su trabajo. La información y los documentos se consultan dentro de la empresa a la que pertenece cada usuario.</p><p className="text-neutral-600 leading-relaxed mt-4">El propietario administra las membresías y puede revocar accesos. Las operaciones importantes quedan registradas para facilitar su seguimiento.</p></div>
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">{[
        ['Propietario', 'Configuración y administración', 'Gestiona la información empresarial, las autorizaciones, los miembros, los permisos y la suscripción.'],
        ['Facturador', 'Trabajo de facturación', 'Prepara y emite documentos de acuerdo con los permisos de su rol y el estado de la empresa.'],
        ['Consulta', 'Revisión de información', 'Consulta el historial sin crear ni emitir documentos. Las exportaciones dependen del permiso asignado.'],
      ].map(([name, label, description], index) => <article key={name} className={`p-7 ${index ? 'border-t border-neutral-200' : 'bg-[#7A1C24]/[0.03]'}`}><div className="flex flex-wrap justify-between items-center gap-2 mb-3"><h3 className="font-bold text-lg">{name}</h3><span className="text-xs uppercase tracking-wide text-[#7A1C24]">{label}</span></div><p className="text-neutral-600 text-sm leading-relaxed">{description}</p></article>)}</div>
    </section>

    <section id="como-empezar" className="bg-[#292a2e] text-white py-20"><div className="max-w-7xl mx-auto px-6"><div className="max-w-2xl mb-12"><p className="text-[#e397a1] text-sm font-bold tracking-widest uppercase">Del registro a tu primera emisión</p><h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4 mb-5">Comienza con una base bien preparada.</h2><p className="text-neutral-300 leading-relaxed">Primero tu acceso, después los datos de tu empresa y las autorizaciones que utilizarás para facturar.</p></div><ol className="grid sm:grid-cols-2 xl:grid-cols-4 gap-7">{[
      ['Crea y verifica tu cuenta', 'Registra el responsable y la empresa. Recibirás un correo con un botón para confirmar tu dirección y continuar al acceso.'],
      ['Completa tu empresa', 'Revisa razón social, RTN, direcciones, contacto y presentación de tus documentos. Guarda los datos de tus clientes.'],
      ['Activa tu servicio', 'Consulta las instrucciones de pago, registra la referencia y adjunta tu comprobante para la revisión de BWP.'],
      ['Registra tu CAI y factura', 'Ingresa tu autorización, rango y fecha límite. Prepara el documento, revisa los importes y confirma su emisión.'],
    ].map(([title, description], index) => <li key={title} className="border-t border-white/20 pt-6"><p className="text-[#e397a1] text-sm mb-4">Paso {index + 1}</p><h3 className="font-bold text-lg mb-3">{title}</h3><p className="text-sm text-neutral-300 leading-relaxed">{description}</p></li>)}</ol></div></section>
  </>;
}

export function FrequentlyAskedQuestions() {
  return <section id="preguntas" className="bg-white border-t border-neutral-200 py-20"><div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[.8fr_1.2fr] gap-12">
    <div><p className="text-[#7A1C24] uppercase tracking-widest text-sm font-bold">Antes de comenzar</p><h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4 mb-5">Resolvemos tus dudas.</h2><p className="text-neutral-600 leading-relaxed">Conoce cómo funciona el acceso, qué necesitas para emitir y cómo administrar tu servicio.</p><a href="mailto:bwpsoporte@gmail.com" className="inline-block text-[#7A1C24] font-semibold underline underline-offset-4 mt-6">Hablar con soporte BWP</a></div>
    <div className="divide-y divide-neutral-200">{[
      ['¿Qué necesito para emitir una factura fiscal?', 'Una cuenta con correo verificado, la empresa configurada, la activación comercial aprobada y una autorización CAI vigente con números disponibles. Registra los datos de tu autorización antes de preparar tu primera factura.'],
      ['¿La plataforma obtiene el CAI por mi empresa?', 'Debes contar con tu autorización correspondiente. En BWP NEXO registras el CAI, los rangos, el establecimiento, el punto de emisión y las fechas que aparecen en esa autorización para controlar su uso.'],
      ['¿Puedo preparar una cotización antes de facturar?', 'Sí. Puedes trabajar con borradores y cotizaciones. Guardar un borrador no consume un correlativo fiscal. La emisión depende del estado de la suscripción y, para los documentos fiscales, de la autorización registrada.'],
      ['¿Cómo se activa mi suscripción?', 'El propietario consulta las instrucciones bancarias, registra la referencia y adjunta el comprobante desde Mi suscripción. BWP revisa el pago y actualiza el estado. La activación no es automática al subir un archivo.'],
      ['¿Qué ocurre si vence el CAI o se agota el rango?', 'La emisión fiscal se bloquea cuando no existe una autorización válida con disponibilidad. Puedes registrar una nueva autorización y conservar la anterior en el historial.'],
      ['¿Cómo recibe el documento mi cliente?', 'Puedes descargarlo, imprimirlo o enviarlo por correo con el PDF adjunto, confirmando el destinatario. Para WhatsApp puedes compartir un enlace temporal del documento o descargar el archivo para adjuntarlo.'],
      ['¿Puedo trabajar con mi equipo?', 'Sí. El propietario puede invitar miembros con roles de propietario, facturador o consulta. Cada persona utiliza su propio acceso y trabaja con los permisos asignados.'],
      ['¿Qué pasa con los documentos si vence la suscripción?', 'La emisión de nuevos documentos se bloquea según el estado del servicio. El historial permanece disponible para consulta, descarga de PDF y las exportaciones que permitan tus permisos.'],
      ['¿Cómo recupero el acceso a mi cuenta?', 'Desde el formulario de acceso puedes solicitar un correo de recuperación. El enlace vence en una hora, es de un solo uso y permite establecer una nueva contraseña.'],
    ].map(([question, answer]) => <details key={question} className="group py-5"><summary className="cursor-pointer font-semibold text-base leading-relaxed pr-4 marker:text-[#7A1C24] focus-visible:outline-2 focus-visible:outline-[#7A1C24]">{question}</summary><p className="text-neutral-600 leading-relaxed mt-4 pl-4">{answer}</p></details>)}</div>
  </div><div className="max-w-7xl mx-auto px-6 mt-16"><div className="bg-[#7A1C24]/5 border border-[#7A1C24]/15 rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-7"><div><h3 className="text-2xl font-bold tracking-tight mb-3">Dale un lugar profesional a tu facturación.</h3><p className="text-neutral-600">Crea tu cuenta en BWP NEXO y prepara tu empresa para comenzar.</p></div><Link href="/registro" className="shrink-0 bg-[#7A1C24] text-white rounded-xl px-7 py-4 font-semibold">Registrar mi empresa</Link></div></div></section>;
}
