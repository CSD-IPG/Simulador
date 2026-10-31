import './core.js';
const cors={'Access-Control-Allow-Origin':'https://csd-ipg.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const core=(globalThis as unknown as {CSDMonthlyCore:{metrics:(d:any)=>any;buildPDF:(d:any,m:any,h:string)=>string;buildCSV:(d:any)=>string;buildBackup:(d:any,h:string)=>string}}).CSDMonthlyCore;
Deno.serve(async(req:Request)=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.headers.get('origin')!=='https://csd-ipg.github.io')return reply({error:'Origen no permitido'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 const base=Deno.env.get('SUPABASE_URL')!,publicKey=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,authorization=req.headers.get('authorization')||'';
 const userHeaders={apikey:publicKey,Authorization:authorization,'Content-Type':'application/json'};
 const adminHeaders={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 let prefix='';const uploaded:string[]=[];
 try{
  const [role,user]=await Promise.all([fetch(base+'/rest/v1/rpc/es_usuario_escuela',{method:'POST',headers:userHeaders,body:'{}'}),fetch(base+'/auth/v1/user',{headers:userHeaders})]);
  if(!role.ok||await role.json()!==true||!user.ok)return reply({error:'Acceso exclusivo para Dirección autorizada'},403);
  const account=await user.json();const text=await req.text();if(text.length>1024)return reply({error:'Solicitud demasiado grande'},413);const input=JSON.parse(text);
  const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Santiago',year:'numeric',month:'2-digit'}).formatToParts(new Date());const currentMonth=parts.find(x=>x.type==='year')!.value+'-'+parts.find(x=>x.type==='month')!.value;
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(input.mes)||input.mes>currentMonth||typeof input.excluir_pruebas!=='boolean')return reply({error:'Selecciona un mes iniciado y un criterio de pruebas válido'},400);
  const response=await fetch(base+'/rest/v1/rpc/reporte_mensual_csd',{method:'POST',headers:userHeaders,body:JSON.stringify({p_mes:input.mes+'-01',p_excluir_pruebas:input.excluir_pruebas})});
  if(!response.ok)throw Error('consulta');const data=await response.json();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const id=crypto.randomUUID();prefix=data.mes+'/'+id;const files=[['informe.pdf','application/pdf',core.buildPDF(data,core.metrics(data),hash)],['detalle.csv','text/csv',core.buildCSV(data)],['respaldo.json','application/json',core.buildBackup(data,hash)]];
  for(const [name,type,content] of files){const path=prefix+'/'+name;const result=await fetch(base+'/storage/v1/object/csd-informes-mensuales/'+path,{method:'POST',headers:{...adminHeaders,'Content-Type':type,'x-upsert':'false'},body:content});if(!result.ok)throw Error('archivo');uploaded.push(path)}
  const record={id,mes:data.mes+'-01',generado_en:data.generado_en,creado_por:account.id,sha256:hash,storage_prefix:prefix,excluye_pruebas:data.excluye_pruebas,corte_parcial:new Date(data.hasta_exclusivo)>new Date(),resumen:Object.fromEntries(['accesos','actividades','evaluaciones','impulsa','descargas'].map(k=>[k,data[k].length]))};
  const stored=await fetch(base+'/rest/v1/csd_informes_mensuales',{method:'POST',headers:adminHeaders,body:JSON.stringify(record)});if(!stored.ok)throw Error('registro');
  return reply({ok:true,informe:record,contenido:data});
 }catch{
  if(uploaded.length)await fetch(base+'/storage/v1/object/csd-informes-mensuales',{method:'DELETE',headers:adminHeaders,body:JSON.stringify({prefixes:uploaded})}).catch(()=>{});
  return reply({error:'No se pudo generar y guardar el informe. Puedes reintentar; las copias anteriores se conservan.'},500)
 }
});
