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
  const parts=location.pathname.split('/').filter(Boolean);const module=(parts.at(-1)==='index.html'?parts.at(-2):parts.at(-1))||'recurso';
  const sidKey='csd_perfil_sid_'+module;
  let sid=sessionStorage.getItem(sidKey);
  if(!sid){sid=crypto.randomUUID?crypto.randomUUID():'csd-'+Date.now()+'-'+Math.random().toString(36).slice(2);sessionStorage.setItem(sidKey,sid)}
  const url=typeof IPG_AUTH_URL!=='undefined'?IPG_AUTH_URL:typeof SUPABASE_URL!=='undefined'?SUPABASE_URL:null;
  const key=typeof IPG_AUTH_ANON!=='undefined'?IPG_AUTH_ANON:typeof SUPABASE_ANON_KEY!=='undefined'?SUPABASE_ANON_KEY:typeof ANON_KEY!=='undefined'?ANON_KEY:null;
  if(!url||!key)return;
  try{const r=await fetch(url+'/rest/v1/rpc/registrar_perfil_participacion_csd',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key},body:JSON.stringify({p_email:email,p_modulo:module,p_session_id:sid,p_perfil:perfil})});if(!r.ok)console.warn('No se registró perfil CSD:',r.status)}catch(e){console.warn('Sin conexión de perfil CSD')}
 }

 function privacyGate(){
  const module=location.pathname.split('/').filter(Boolean).filter(x=>x!=='index.html').pop()||'recurso';
  const key='csd_privacidad_aceptada_v1_'+module;
  let accepted=false;try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');accepted=!!(saved&&saved.version==='csd-academico-v1'&&saved.accepted)}catch(e){}
  if(accepted)return;
  const css=document.createElement('style');
  css.textContent='#csdPrivacyGate{position:fixed!important;inset:0!important;z-index:2147483647!important;background:rgba(3,12,26,.94)!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:18px!important;overflow:auto!important;font-family:system-ui,Arial,sans-serif!important;color:#f3faff!important}#csdPrivacyGate *{box-sizing:border-box!important}#csdPrivacyGate .privacy-card{background:linear-gradient(150deg,#16334e,#0b1c32)!important;color:#f3faff!important;border:1px solid #537a97!important;border-radius:20px!important;padding:clamp(20px,4vw,34px)!important;max-width:620px!important;width:100%!important;box-shadow:0 20px 80px #0009!important}#csdPrivacyGate h2{color:#f5fbff!important;margin:0 0 14px!important;font-size:25px!important}#csdPrivacyGate p{color:#c9e0ef!important;line-height:1.65!important;font-size:14px!important}#csdPrivacyGate label{display:flex!important;gap:12px!important;align-items:flex-start!important;color:#fff!important;font-size:14px!important;line-height:1.55!important;margin:18px 0!important}#csdPrivacyGate input{width:19px!important;height:19px!important;flex:none!important;accent-color:#62dbe4!important}#csdPrivacyGate button{background:#6cdee5!important;color:#062239!important;border:0!important;border-radius:11px!important;padding:13px 20px!important;font-weight:800!important;cursor:pointer!important}#csdPrivacyGate button:disabled{opacity:.4!important;cursor:not-allowed!important}';
  document.head.appendChild(css);
  const layer=document.createElement('div');layer.id='csdPrivacyGate';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','csdPrivacyTitle');
  const card=document.createElement('section');card.className='privacy-card';
  const h=document.createElement('h2');h.id='csdPrivacyTitle';h.textContent='Uso académico y protección de datos';
  const p=document.createElement('p');p.textContent=['impulsa','nivelacion-matematica','nivelacion-matematica-2','refuerzo-tecnologias','refuerzo-tecnologias-2','refuerzo-lectura','refuerzo-lectura-2'].includes(module)?'Este pilotaje utiliza el correo institucional y el perfil declarados, carrera, participación y resultados para acompañamiento y seguimiento académico. No recopila RUT, no crea cuentas ni verifica el correo. Los resultados individuales se restringen al personal autorizado de Dirección. Los módulos de nivelación 2 son de acceso libre.':'Para utilizar este recurso del Centro de Simulación Digital, IPG tratará los datos de identificación declarados (incluido correo institucional y RUT cuando se solicite), participación, actividades y resultados, con fines de trazabilidad, acompañamiento, reforzamiento y seguimiento académico de la Escuela. Los registros son de uso institucional y se restringirán al personal autorizado.';
  const label=document.createElement('label');const cb=document.createElement('input');cb.type='checkbox';cb.required=true;const message=document.createElement('span');message.textContent='He leído esta información y autorizo el tratamiento de mis datos para los fines académicos indicados.';label.append(cb,message);
  const button=document.createElement('button');button.type='button';button.disabled=true;button.textContent='Aceptar y continuar';
  cb.addEventListener('change',()=>{button.disabled=!cb.checked});
  button.addEventListener('click',()=>{if(!cb.checked)return;try{sessionStorage.setItem(key,JSON.stringify({accepted:true,version:'csd-academico-v1',fecha:new Date().toISOString()}))}catch(e){}layer.remove();css.remove()});
  card.append(h,p,label,button);layer.append(card);document.body.append(layer);button.focus();
 }
 document.addEventListener('DOMContentLoaded',()=>{privacyGate();ensureProfile();apply();document.addEventListener('change',store,true);document.addEventListener('click',e=>{if(e.target?.closest?.('#ipgAuthLogin'))registrarPerfil()},true);document.addEventListener('input',e=>{if(e.target&&e.target.id==='ipgAuthEmail')store()},true)});
})();