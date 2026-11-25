import pg from 'pg';
import nodemailer from 'nodemailer';
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000});
try { await pool.query('SELECT 1'); console.log('Neon: conexión verificada.'); }
catch {console.error('Neon: no se pudo verificar la conexión.');process.exitCode=1;}
finally {await pool.end();}
const transport=nodemailer.createTransport({host:process.env.GMAIL_SMTP_HOST,port:Number(process.env.GMAIL_SMTP_PORT || 587),secure:false,requireTLS:true,auth:{user:process.env.GMAIL_EMAIL,pass:process.env.GMAIL_PASSWORD},connectionTimeout:15000,socketTimeout:15000});
try {await transport.verify();console.log('Gmail: autenticación SMTP verificada.');}
catch(err) {console.error('Gmail: verificación fallida ('+(err.code || 'conexión')+').');process.exitCode=1;}
finally {transport.close();}
