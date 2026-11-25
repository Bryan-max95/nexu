export function validateAttachment(value: unknown, pdfOnly = false): string | undefined {
  if (!value) return undefined;
  if (typeof value !== 'string' || value.length > 2_800_000) throw {status:422,message:'El archivo debe ser menor de 2 MB.'};
  const match = /^data:(application\/pdf|image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || (pdfOnly && match[1] !== 'application/pdf')) throw {status:422,message:'Formato de archivo inválido.'};
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'application/pdf' ? bytes.subarray(0,5).toString() === '%PDF-' : match[1] === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if (!valid) throw {status:422,message:'El contenido no coincide con el tipo de archivo.'};
  return value;
}
