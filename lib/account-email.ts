import { OFFICIAL_APP_URL, OFFICIAL_APP_DOMAIN } from './app-origin';

type AccountEmailOptions = {
  email: string;
  actionUrl: string;
  kind: 'verify' | 'reset';
  supportEmail?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function buildAccountEmail({ email, actionUrl, kind, supportEmail }: AccountEmailOptions) {
  const verify = kind === 'verify';
  const url = new URL(actionUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('El enlace del correo debe usar HTTP o HTTPS.');
  if (process.env.NODE_ENV === 'production' && url.origin !== OFFICIAL_APP_URL) throw new Error('Los correos de producción solo pueden enlazar a https://bwpnexo.it.com.');
  const safeUrl = escapeHtml(url.toString());
  const safeEmail = escapeHtml(email);
  const support = supportEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ? supportEmail : 'bwpsoporte@gmail.com';
  const safeSupport = escapeHtml(support);
  const subject = verify ? 'Confirma tu correo y comienza con BWP NEXO' : 'Restablece tu contraseña de BWP NEXO';
  const preheader = verify ? 'Tu espacio de trabajo está a un paso. Verifica tu correo para continuar.' : 'Recupera el acceso a tu cuenta con este enlace personal y de un solo uso.';
  const title = verify ? 'Un paso más<br>para comenzar.' : 'Recupera el acceso<br>a tu cuenta.';
  const action = verify ? 'Verificar mi correo' : 'Restablecer mi contraseña';
  const intro = verify
    ? 'Gracias por elegir BWP NEXO. Confirma tu dirección de correo electrónico para continuar con el acceso a tu cuenta empresarial.'
    : 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa el botón para crear una nueva contraseña y recuperar tu acceso.';
  const after = verify
    ? 'Después de verificar tu correo, podrás iniciar sesión y configurar tu empresa desde tu espacio de trabajo.'
    : 'Por seguridad, al restablecer tu contraseña se cerrarán las sesiones anteriores de tu cuenta.';
  const text = [
    `BWP NEXO · ${OFFICIAL_APP_DOMAIN} · Una empresa BWP`, '', subject, '', intro, '', `Cuenta: ${email}`, '',
    `${action}: ${url.toString()}`, '', 'Este enlace es personal, vence en 1 hora y solo puede utilizarse una vez.', '', after, '',
    'Si no solicitaste esta acción, puedes ignorar este correo. Nunca te pediremos tu contraseña por correo electrónico.', '', `¿Necesitas ayuda? ${support}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]><style>table,td,p,a,h1{font-family:Arial,sans-serif!important;}table{border-collapse:collapse!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;color:#24262a;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;color:#f3f4f6;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:32px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr><td align="center" style="padding:0 0 18px;color:#6b7280;font-size:12px;line-height:18px;letter-spacing:1.5px;">TU EMPRESA. TODO CONECTADO.</td></tr>
        <tr><td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="6" style="height:6px;background-color:#7a1c24;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr><td style="padding:32px 32px 26px;border-bottom:1px solid #eef0f2;">
              <img src="cid:bwp-nexo-logo" width="184" height="62" alt="BWP NEXO" style="display:block;width:184px;height:auto;max-width:100%;border:0;color:#7a1c24;font-size:24px;font-weight:bold;">
              <p style="margin:12px 0 0;font-size:12px;line-height:18px;color:#6b7280;letter-spacing:1px;">FACTURACIÓN FISCAL EMPRESARIAL</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <p style="margin:0 0 16px;color:#7a1c24;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1.5px;">${verify ? 'CONFIRMA TU CUENTA' : 'SEGURIDAD DE TU CUENTA'}</p>
              <h1 style="margin:0 0 22px;color:#24262a;font-size:34px;line-height:41px;font-weight:700;letter-spacing:-1px;">${title}</h1>
              <p style="margin:0 0 24px;color:#525866;font-size:16px;line-height:26px;">${intro}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f7f8;border:1px solid #e9eaed;border-radius:10px;">
                <tr><td style="padding:16px 18px;">
                  <p style="margin:0 0 5px;color:#6b7280;font-size:12px;line-height:18px;">CORREO DE TU CUENTA</p>
                  <p style="margin:0;color:#24262a;font-size:15px;line-height:23px;font-weight:bold;word-break:break-all;">${safeEmail}</p>
                </td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td align="center" style="padding:28px 0 14px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr><td align="center" bgcolor="#7a1c24" style="border-radius:9px;mso-padding-alt:17px 24px;">
                      <a href="${safeUrl}" target="_blank" style="display:block;padding:17px 24px;border:1px solid #7a1c24;border-radius:9px;background-color:#7a1c24;color:#ffffff;text-align:center;text-decoration:none;font-size:16px;line-height:22px;font-weight:bold;">${action}</a>
                    </td></tr>
                  </table>
                </td></tr>
                <tr><td align="center" style="padding:0 0 26px;color:#7a1c24;font-size:13px;line-height:20px;">Enlace personal &middot; Válido durante 1 hora &middot; Un solo uso</td></tr>
              </table>
              <p style="margin:0 0 24px;color:#525866;font-size:15px;line-height:25px;">${after}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fbf4f5;border-left:3px solid #7a1c24;">
                <tr><td style="padding:16px 18px;color:#65474c;font-size:13px;line-height:21px;"><strong>Tu cuenta, bajo tu control.</strong><br>Si no solicitaste esta acción, puedes ignorar este mensaje. Nunca te pediremos tu contraseña por correo electrónico.</td></tr>
              </table>
            </td></tr>
            <tr><td style="padding:24px 32px;background-color:#fafafa;border-top:1px solid #eef0f2;">
              <p style="margin:0 0 10px;color:#6b7280;font-size:12px;line-height:20px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
              <p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="${safeUrl}" style="color:#7a1c24;text-decoration:underline;word-break:break-all;">${safeUrl}</a></p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:26px 18px 8px;">
          <p style="margin:0 0 8px;color:#24262a;font-size:14px;line-height:22px;font-weight:bold;">BWP NEXO <span style="color:#9ca3af;font-weight:normal;">&middot;</span> Una empresa BWP</p>
          <p style="margin:0 0 12px;font-size:13px;line-height:20px;"><a href="${OFFICIAL_APP_URL}" style="color:#7a1c24;text-decoration:none;font-weight:bold;">${OFFICIAL_APP_DOMAIN}</a></p>
          <p style="margin:0 0 12px;color:#6b7280;font-size:12px;line-height:20px;">Herramientas profesionales para el día a día de tu empresa.</p>
          <p style="margin:0;color:#6b7280;font-size:12px;line-height:20px;">¿Necesitas ayuda? <a href="mailto:${safeSupport}" style="color:#7a1c24;text-decoration:underline;">${safeSupport}</a></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}
