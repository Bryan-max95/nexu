import nodemailer from 'nodemailer';
import path from 'node:path';
import { buildAccountEmail } from './account-email';
import { getAppOrigin, OFFICIAL_APP_DOMAIN } from './app-origin';

export function mailIdentity() {
  const address = process.env.MAIL_FROM_EMAIL || process.env.GMAIL_EMAIL;
  if (process.env.MAIL_FROM_EMAIL && !/^[^\s@<>]+@bwpnexo\.it\.com$/i.test(process.env.MAIL_FROM_EMAIL)) {
    throw new Error('MAIL_FROM_EMAIL debe ser un buzón autorizado de bwpnexo.it.com.');
  }
  return { name: `BWP NEXO · ${OFFICIAL_APP_DOMAIN}`, address: address || '' };
}

export function mailer() {
  return nodemailer.createTransport({
    host: process.env.GMAIL_SMTP_HOST,
    port: Number(process.env.GMAIL_SMTP_PORT || 587),
    secure: Number(process.env.GMAIL_SMTP_PORT) === 465,
    requireTLS: true,
    auth: { user: process.env.GMAIL_EMAIL, pass: process.env.GMAIL_PASSWORD },
    connectionTimeout: 15000, socketTimeout: 20000,
  });
}

export async function sendAccountMail(email: string, token: string, kind: 'verify' | 'reset') {
  const base = getAppOrigin();
  const url = new URL(kind === 'verify' ? '/verificar' : '/recuperar', base);
  url.searchParams.set('token', token);
  const content = buildAccountEmail({ email, actionUrl: url.toString(), kind, supportEmail: process.env.YOUR_EMAIL });
  await mailer().sendMail({
    from: mailIdentity(), to: email,
    replyTo: process.env.YOUR_EMAIL || process.env.GMAIL_EMAIL,
    ...content,
    attachments: [{ filename: 'bwp-nexo.png', path: path.join(process.cwd(), 'public', 'logo-bwp-nexo.png'), cid: 'bwp-nexo-logo', contentDisposition: 'inline' }],
  });
}
