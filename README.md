# BWP NEXO

Aplicación Next.js para facturación empresarial. La portada pública está en `/`, el acceso común en `/login`, el registro en `/registro` y el panel privado en `/panel`. El servidor decide qué panel corresponde al usuario.

## Ejecutar

1. Instalar Node.js LTS (22 o 24) y pnpm 9.15.4 y ejecutar `pnpm install`.
2. Configurar `.env.local` según `.env.example`. Las credenciales entregadas para este proyecto ya están en el archivo local ignorado por Git. Ninguna variable secreta debe llevar el prefijo `NEXT_PUBLIC_`.
3. Ejecutar `pnpm dev` y abrir `http://localhost:3000`.
4. Para producción: `pnpm build` y `pnpm start`. El dominio oficial es `https://bwpnexo.it.com`; consultar `.env.production.example` para los nombres de variables del servidor.

El administrador entra por el mismo formulario con `ROOT_USERNAME` y `ROOT_PASSWORD`. La cuenta administrativa se crea en la primera operación contra la base de datos. El registro público siempre crea clientes; nunca permite solicitar privilegios administrativos.

## Datos y acceso

Todas las rutas de negocio ejecutan una transacción PostgreSQL. La tabla `bwp_application_state` se crea automáticamente en Neon. Conserva usuarios, empresas, miembros, clientes, autorizaciones, documentos y sus instantáneas fiscales, suscripciones, pagos, respaldos, notificaciones, auditoría y configuración en un agregado JSONB. Los archivos adjuntos de hasta 2 MB se guardan dentro del registro correspondiente.

Un bloqueo transaccional de PostgreSQL protege el estado entre procesos, incluidos los correlativos y las claves de idempotencia. Los errores no pasan a un archivo temporal ni a datos de demostración. Este modelo prioriza compatibilidad con el motor fiscal existente; para volúmenes altos conviene migrar el agregado a tablas por entidad y los archivos a almacenamiento de objetos, manteniendo las transacciones de emisión.

Las sesiones usan una cookie HttpOnly con SameSite y firma HMAC mediante `SESSION_SECRET`. El token no se devuelve en el JSON al navegador. Las sesiones se registran en Neon y se revocan al cerrar sesión o restablecer la contraseña. Las API comprueban la membresía activa y el rol en cada operación. El cliente no puede seleccionar otra empresa mediante el formulario.

El registro envía un correo por Gmail SMTP y no abre una sesión hasta verificarlo. Los enlaces de verificación y recuperación vencen en una hora, se guardan con hash y son de un solo uso. Las invitaciones de equipo envían un enlace para establecer una contraseña propia. Los PDF se generan en el servidor a partir de la instantánea del documento y se adjuntan al correo solicitado.

Configurar los datos bancarios y el contacto de soporte desde administración antes de solicitar pagos. Registrar las autorizaciones CAI reales de cada empresa antes de emitir documentos fiscales.

## Verificar

- `pnpm build`: compilación y tipos.
- `node --env-file=.env.local --import tsx --test tests/core.test.ts`: contraseñas, sesiones, aislamiento de contexto, PDF multipágina y archivos.
- `node --env-file=.env.local scripts/check-services.mjs`: conexión real a Neon y autenticación SMTP, sin enviar mensajes.

Los PDF admiten Carta y A4, tres estilos y descripciones largas con continuación entre páginas. La vista previa del formulario es orientativa; el PDF descargado es el documento generado por el servidor.

La prueba opcional `pnpm test:integration` utiliza Neon real y un transporte de correo simulado. Comprueba permisos, límites persistentes y revocación de sesiones, y elimina sus registros temporales al finalizar. `pnpm check:services` comprueba la autenticación real de Gmail sin enviar mensajes.

## Instalación y arranque con pnpm

Este proyecto utiliza pnpm y pnpm-lock.yaml. Usar `pnpm install` y luego `pnpm dev` para desarrollo. Para producción, `pnpm build` y `pnpm start`. No mezclar npm y pnpm en node_modules. La compilación usa el modo estándar de Next.js, compatible con pnpm start.

Desarrollo utiliza `.next-dev` y producción `.next-production` para evitar interferencias entre procesos. Si un puerto ya está ocupado, desarrollo muestra el siguiente disponible; para producción se puede indicar `pnpm start --port 3001`. `APP_URL` debe coincidir con la dirección donde se abre la aplicación para que los correos apunten al lugar correcto.

## Dominio oficial y correo

Con `NODE_ENV=production`, los enlaces de verificación, recuperación y documentos compartidos usan exclusivamente `https://bwpnexo.it.com`. Un `APP_URL` local o un encabezado Origin no puede sustituir ese dominio. El generador de correo también rechaza enlaces de acción hacia otros dominios en producción.

En desarrollo, `APP_URL` puede apuntar a localhost o una dirección de loopback, con su puerto. Las vistas previas del correo muestran el dominio oficial con tokens de muestra sin validez.

El nombre visible del remitente incluye BWP NEXO y bwpnexo.it.com. La dirección remitente sigue siendo la cuenta Gmail autenticada mientras `MAIL_FROM_EMAIL` esté vacío. Para enviar como `soporte@bwpnexo.it.com` se necesita un buzón o alias autorizado por el proveedor SMTP; definir el nombre de dominio en la web no crea ni verifica ese buzón. `MAIL_FROM_EMAIL` solo admite direcciones de bwpnexo.it.com. Las credenciales y la configuración DNS del proveedor se gestionan fuera del código.

La configuración local no publica el dominio ni configura DNS, hosting o certificados. Al desplegar, apuntar bwpnexo.it.com al servidor y habilitar HTTPS antes de utilizar los enlaces de producción.

Se agregaron encabezados contra inclusión en marcos, detección incorrecta de contenido y carga de objetos; las API usan no-store. Las operaciones rechazan solicitudes de otros orígenes y cuerpos de más de 4 MB. Los límites de autenticación por cuenta se guardan en PostgreSQL para persistir entre reinicios. Estos controles requieren HTTPS y una configuración adecuada del servidor al publicar; no constituyen una certificación de seguridad.

## Web corporativa y consultas empresariales

La web pública incluye seis áreas: `/soluciones`, `/implementacion`, `/recursos`, `/seguridad`, `/empresa` y `/contacto`. La página de soluciones permite buscar y filtrar 16 capacidades que se organizan dentro de los siete módulos del panel. Los recursos incluyen guías, PDF de muestra y un CSV ilustrativo.

El formulario de contacto registra una consulta mediante `POST /api/contact`, con consentimiento, validación de tamaño y límites persistentes de frecuencia. Se guarda en Neon como ticket de origen público, identificado con una referencia `BWP-CON-...`. La identidad del visitante se considera declarada, sin verificación de correo. Las consultas solo se consultan desde administración, en **Consultas y soporte**, y su atención queda registrada con justificación. El formulario no envía correos automáticamente ni promete un tiempo de respuesta.

## Términos, privacidad y sello BWP

La página `/terminos` presenta la información del servicio con índice de diez secciones y estilos de impresión. El sello está en `public/brand/bwp-pentesting-sello.png` y utiliza transparencia. Es una identidad visual de BWP Pentesting; no acredita una certificación independiente ni sustituye un informe de auditoría. Su alcance se explica en la propia página.
