export const contactTopics = [
  { value:'COMERCIAL', label:'Información comercial y planes' },
  { value:'IMPLEMENTACION', label:'Preparación e implementación' },
  { value:'SOPORTE', label:'Uso de la plataforma y soporte' },
  { value:'SEGURIDAD', label:'Consulta de seguridad' },
] as const;

export function validateContactRequest(body: Record<string, unknown>) {
  const read=(key:string)=>typeof body[key]==='string'?(body[key] as string).trim():'';
  const name=read('name'),company=read('company'),email=read('email').toLowerCase(),phone=read('phone'),topic=read('topic'),message=read('message');
  if(name.length<2||name.length>100||company.length<2||company.length>160) throw {status:422,message:'Indica tu nombre y el nombre de la empresa (máximo 100 y 160 caracteres).'};
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw {status:422,message:'Indica un correo electrónico válido.'};
  if(phone.length>40||message.length<20||message.length>2500) throw {status:422,message:'La consulta debe contener entre 20 y 2,500 caracteres; el teléfono no debe superar 40.'};
  const selected=contactTopics.find(t=>t.value===topic);
  if(!selected||body.consent!==true) throw {status:422,message:'Selecciona el motivo y acepta el uso de tus datos para atender la consulta.'};
  return {name,company,email,phone,topic:selected.value,topicLabel:selected.label,message};
}
