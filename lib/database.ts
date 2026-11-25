import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, PoolClient } from 'pg';
import { NextResponse } from 'next/server';
import { createInitialState, databaseContext, hashPassword } from './server-store';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 15000 });
const connectionContext = new AsyncLocalStorage<PoolClient>();

// Attempts survive process restarts and cannot be bypassed by changing a forwarded IP.
export async function consumeAuthAttempt(key: string, maximum: number, windowMs: number): Promise<boolean> {
  const client = connectionContext.getStore();
  if (!client) throw new Error('Se requiere una transacción.');
  await client.query('CREATE TABLE IF NOT EXISTS bwp_auth_limits (key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL)');
  await client.query('DELETE FROM bwp_auth_limits WHERE reset_at <= now()');
  const result = await client.query('INSERT INTO bwp_auth_limits (key, count, reset_at) VALUES ($1, 1, now() + $2 * interval \'1 millisecond\') ON CONFLICT (key) DO UPDATE SET count = bwp_auth_limits.count + 1 RETURNING count', [crypto.createHash('sha256').update(key).digest('hex'), windowMs]);
  return result.rows[0].count <= maximum;
}

// A single durable JSONB aggregate preserves the existing fiscal model. PostgreSQL
// row locking serializes allocations across processes, including duplicate requests.
export function databaseRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const request = args[0];
    if (request instanceof Request && !['GET','HEAD','OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return NextResponse.json({error:'Origen de solicitud no permitido.'},{status:403});
      if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({error:'Solicitud entre sitios no permitida.'},{status:403});
      if (request.body) {
        const reader = request.clone().body!.getReader(); let bytes = 0;
        try {
          while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 4 * 1024 * 1024) { void reader.cancel().catch(() => {}); return NextResponse.json({error:'Solicitud demasiado grande.'},{status:413}); } }
        } finally { reader.releaseLock(); }
      }
    }
    const client = await pool.connect().catch(() => null);
    if (!client) return NextResponse.json({ error: 'No se pudo conectar con la base de datos.' }, { status: 503 });
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(198595)');
      await client.query('CREATE TABLE IF NOT EXISTS bwp_application_state (id integer PRIMARY KEY CHECK (id = 1), data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
      await client.query('INSERT INTO bwp_application_state (id, data) VALUES (1, $1) ON CONFLICT DO NOTHING', [JSON.stringify(createInitialState())]);
      const result = await client.query('SELECT data FROM bwp_application_state WHERE id = 1 FOR UPDATE');
      const db = result.rows[0].data as ReturnType<typeof createInitialState>;
      const username = process.env.ROOT_USERNAME;
      const password = process.env.ROOT_PASSWORD;
      if (username && password) {
        let admin = db.users.find(u => u.id === 'bwp-root');
        if (!admin) {
          const { hash, salt } = hashPassword(password);
          admin = { id: 'bwp-root', name: 'Administración BWP', email: username, whatsapp: '', passwordHash: hash, passwordSalt: salt, emailVerified: true, isSuperAdmin: true, mfaEnabled: false, termsAcceptedVersion: 'admin', termsAcceptedAtUtc: new Date().toISOString(), createdAtUtc: new Date().toISOString() };
          db.users.push(admin);
        }
      }
      if (username) { const admin = db.users.find(u => u.id === 'bwp-root'); if(admin) admin.email = username; }
      const response = await connectionContext.run(client, () => databaseContext.run(db, () => handler(...args)));
      if (response.status < 400) {
        await client.query('UPDATE bwp_application_state SET data = $1, updated_at = now() WHERE id = 1', [JSON.stringify(db)]);
      }
      await client.query('COMMIT');
      return response;
    } catch (error) {
      const detail = error as { code?: string; name?: string };
      console.error('BWP database request failed', { code: detail.code, type: detail.name });
      if (error instanceof Error && !detail.code) {
        let reason = error.stack || error.message;
        for (const key of ['DATABASE_URL', 'ROOT_PASSWORD', 'GMAIL_PASSWORD', 'SESSION_SECRET']) {
          const secret = process.env[key]; if (secret) reason = reason.split(secret).join('[redacted]');
        }
        console.error(reason);
      }
      await client.query('ROLLBACK').catch(() => {});
      return NextResponse.json({ error: 'No se pudo completar la operación. Intente nuevamente.' }, { status: 503 });
    } finally { client.release(); }
  };
}
