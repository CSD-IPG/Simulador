/* Identificación reutilizable en recursos CSD. No habilita accesos ni verifica identidad. */
(()=>{'use strict';
 const KEY='csd_identificacion_sesion_v1';
 const fields={email:['ipgAuthEmail'],perfil:['ipgPerfil','csdPerfil','csdPerfilCompartido'],nombre:['ipgNombre','csdNombre','student'],carrera:['ipgCarrera','csdCarrera','career','stCareer'],seccion:['section','stSection']};
 const validEmail=e=>/^[^\s@]+@(?:alumnos\.ipg\.cl|docentes\.ipg\.cl|ipg\.cl)$/i.test(String(e||'').trim());
 const read=()=>{try{const v=JSON.parse(sessionStorage.getItem(KEY)||'{}');return v&&typeof v==='object'?v:{}}catch{return {}}};
 const get=id=>document.getElementById(id);
 const findValue=key=>{for(const id of fields[key]){const el=get(id);if(el&&el.value&&el.value.trim())return el.value.trim()}return ''};
 const store=()=>{const old=read(),email=findValue('email');if(!validEmail(email))return;const data={email:email.toLowerCase()};
 if(old.email&&old.email!==data.email){sessionStorage.setItem(KEY,JSON.stringify(data));return}
 for(const key of ['perfil','nombre','carrera','seccion']){const value=findValue(key);if(value)data[key]=value.slice(0,160)}
 // RUT no se almacena ni se propaga entre recursos; se solicita según necesidad.
 sessionStorage.setItem(KEY,JSON.stringify(data));
 };
 const apply=()=>{const data=read();if(!validEmail(data.email))return;
 for(const key of Object.keys(fields)){if(!data[key])continue;
  for(const id of fields[key]){const el=get(id);if(!el||el.value)continue;
   if(el.tagName==='SELECT'&&![...el.options].some(x=>x.value===data[key]))continue;
   el.value=data[key];el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }};
 function ensureProfile(){
  if(get('ipgPerfil')||get('csdPerfil')||get('csdPerfilCompartido'))return;
  const email=get('ipgAuthEmail');if(!email)return;
  const container=email.closest('.ipg-auth-grid')||email.parentElement?.parentElement;
  if(!container)return;
  const wrap=document.createElement('div');
  const label=document.createElement('label');label.textContent='Perfil de participación';label.htmlFor='csdPerfilCompartido';
  const select=document.createElement('select');select.id='csdPerfilCompartido';
  [['','Selecciona tu perfil'],['estudiante','Estudiante'],['docente','Docente'],['colaborador','Colaborador'],['equipo_academico','Equipo académico']].forEach(([value,text])=>{const opt=document.createElement('option');opt.value=value;opt.textContent=text;select.appendChild(opt)});
  const saved=read();if(saved.perfil&&[...select.options].some(o=>o.value===saved.perfil))select.value=saved.perfil;
  wrap.append(label,select);container.appendChild(wrap);
  select.addEventListener('change',()=>{const old=read(),email=findValue('email');if(!validEmail(email))return;sessionStorage.setItem(KEY,JSON.stringify({...old,email:email.toLowerCase(),perfil:select.value}))});
 }
 async function registrarPerfil(){
  const email=findValue('email').toLowerCase(),perfil=findValue('perfil');
  if(!validEmail(email)||!['estudiante','docente','colaborador','equipo_academico'].includes(perfil))return;
  const module=location.pathname.split('/').filter(Boolean).slice(-1)[0]||'recurso';
  const sidKey='csd_perfil_sid_'+module;
  let sid=sessionStorage.getItem(sidKey);
  if(!sid){sid=crypto.randomUUID?crypto.randomUUID():'csd-'+Date.now()+'-'+Math.random().toString(36).slice(2);sessionStorage.setItem(sidKey,sid)}
  if(typeof IPG_AUTH_URL==='undefined'||typeof IPG_AUTH_ANON==='undefined')return;
  try{const r=await fetch(IPG_AUTH_URL+'/rest/v1/rpc/registrar_perfil_participacion_csd',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:IPG_AUTH_ANON,Authorization:'Bearer '+IPG_AUTH_ANON},body:JSON.stringify({p_email:email,p_modulo:module,p_session_id:sid,p_perfil:perfil})});if(!r.ok)console.warn('No se registró perfil CSD:',r.status)}catch(e){console.warn('Sin conexión de perfil CSD')}
 }
 document.addEventListener('DOMContentLoaded',()=>{ensureProfile();apply();document.addEventListener('change',store,true);document.addEventListener('click',e=>{if(e.target?.closest?.('#ipgAuthLogin'))registrarPerfil()},true);document.addEventListener('input',e=>{if(e.target&&e.target.id==='ipgAuthEmail')store()},true)});
})();