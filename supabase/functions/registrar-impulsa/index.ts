import keys from './answers.json' with { type: 'json' };
const origin='https://csd-ipg.github.io';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
Deno.serve(async(req:Request)=>{
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.headers.get('origin')!==origin)return reply({error:'Origen no permitido'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 try{
  if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Se requiere JSON'},415);
  const text=await req.text();if(text.length>8192)return reply({error:'Solicitud demasiado grande'},413);
  const p=JSON.parse(text),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const allowed=['eventId','attempt_id','capability','stage','email','perfil','carrera','answers','activities'];
  if(Object.keys(p).some(k=>!allowed.includes(k)))return reply({error:'Campos no permitidos'},400);
  if(!uuid.test(p.attempt_id)||!uuid.test(p.capability)||!['diagnostico','salida'].includes(p.stage))return reply({error:'Intento no válido'},400);
  if(typeof p.email!=='string'||p.email.length>254||!/^\S+@(?:alumnos\.ipg\.cl|docentes\.ipg\.cl|ipg\.cl)$/i.test(p.email)||!['estudiante','docente','colaborador','equipo_academico'].includes(p.perfil)||typeof p.carrera!=='string'||!p.carrera.trim()||p.carrera.length>160)return reply({error:'Identificación declarada no válida'},400);
  if(!Array.isArray(p.answers)||p.answers.length!==30||p.answers.some((a:unknown)=>!Number.isInteger(a)||Number(a)<0||Number(a)>2))return reply({error:'Responde las 30 preguntas'},400);
  const activities=p.activities??{};
  if(typeof activities!=='object'||Array.isArray(activities)||Object.entries(activities).some(([k,v])=>!/^[mtl]-[0-9]$/.test(k)||typeof v!=='boolean'))return reply({error:'Actividades no válidas'},400);
  const scores:Record<string,number>={m:0,t:0,l:0};
  (keys[p.stage as keyof typeof keys] as [string,number][]).forEach(([dim,answer],i)=>{if(p.answers[i]===answer)scores[dim]++});
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.capability));
  const capability_hash=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const result=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/recibir_impulsa_v2',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p:{attempt_id:p.attempt_id,stage:p.stage,email:p.email.trim().toLowerCase(),perfil:p.perfil,carrera:p.carrera.trim(),capability_hash,scores,answers:p.answers,activities}})});
  if(!result.ok){const detail=await result.json();if(String(detail.message).includes('Demasiados'))return reply({error:'Límite temporal de envíos por correo; reintenta más tarde'},429);return reply({error:'No se pudo registrar esta etapa; verifica el diagnóstico previo o reintenta'},409)}
  return reply({ok:true,attempt_id:p.attempt_id,stage:p.stage});
 }catch{return reply({error:'Solicitud no válida o servicio temporalmente no disponible'},400)}
});
