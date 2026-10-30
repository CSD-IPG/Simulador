/* Identificación reutilizable en recursos CSD. No habilita accesos ni verifica identidad. */
(()=>{'use strict';
 const KEY='csd_identificacion_sesion_v1';
 const fields={email:['ipgAuthEmail'],perfil:['ipgPerfil','csdPerfil'],nombre:['ipgNombre','csdNombre','student'],carrera:['ipgCarrera','csdCarrera','career','stCareer'],seccion:['section','stSection']};
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
 document.addEventListener('DOMContentLoaded',()=>{apply();document.addEventListener('change',store,true);document.addEventListener('input',e=>{if(e.target&&e.target.id==='ipgAuthEmail')store()},true)});
})();