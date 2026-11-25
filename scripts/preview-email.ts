import fs from 'node:fs/promises';
import path from 'node:path';
import { buildAccountEmail } from '../lib/account-email';
import { OFFICIAL_APP_URL } from '../lib/app-origin';

async function main() {
  const logo = await fs.readFile(path.join(process.cwd(), 'public/logo-bwp-nexo.png'));
  const output = path.join(process.cwd(), 'artifacts');
  await fs.mkdir(output, { recursive: true });
  for (const kind of ['verify', 'reset'] as const) {
    const email = buildAccountEmail({ email: 'cliente@empresa.com', actionUrl: `${OFFICIAL_APP_URL}/${kind === 'verify' ? 'verificar' : 'recuperar'}?token=VISTA_PREVIA_SIN_VALIDEZ`, kind });
    await fs.writeFile(path.join(output, `correo-${kind === 'verify' ? 'verificacion' : 'recuperacion'}.html`), email.html.replace('cid:bwp-nexo-logo', `data:image/png;base64,${logo.toString('base64')}`));
  }
  console.log('Vistas previas creadas en artifacts/ (enlaces de muestra, sin tokens reales).');
}
main().catch(() => { console.error('No se pudieron crear las vistas previas.'); process.exitCode = 1; });
