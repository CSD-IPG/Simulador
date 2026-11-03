/* CSD IPG · Seguimiento de nivelaciones 1 y 2.
   Identificación declarada; no autentica personas ni recopila RUT. */
(()=>{'use strict';
 const script=document.currentScript;
 const moduleName=script?.dataset?.module||'';
 const allowed=['Office básico · Nivelación 1','Comprensión lectora · Nivelación 1','Matemática · Nivelación 2','Office aplicado · Nivelación 2','Comprensión lectora · Nivelación 2'];
 if(!allowed.includes(moduleName))return;
 const url='https://uegxxazgqvjjqnmpodln.supabase.co/rest/v1/rpc/registrar_resultado_csd_v2';
 const anon='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZ3h4YXpncXZqanFubXBvZGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2OTMxMDksImV4cCI6MjEwNjI2OTEwOX0.93hHsgPuCrPWZma29meYK2w5EDBff4tv80aUky4v_UQ';
 const validEmail=s=>/^[^\s@]+@(?:alumnos\.ipg\.cl|docentes\.ipg\.cl|ipg\.cl)$/i.test(String(s||'').trim());
 const storageId='csd_level_tracking_'+location.pathname.replace(/\W/g,'_');
 const get=(key,store)=>{try{return JSON.parse(store.getItem(key)||'null')}catch{return null}};
 const sidKey=storageId+'_session';
 let sid=sessionStorage.getItem(sidKey);
 if(!sid){sid=crypto.randomUUID?crypto.randomUUID():'level-'+Date.now()+'-'+Math.random().toString(36).slice(2);sessionStorage.setItem(sidKey,sid)}
 const identityKey=storageId+'_email',outboxKey=storageId+'_outbox',countsKey=storageId+'_attempts';
 const route=get('csd_impulsa_ruta_iniciada_v2',localStorage);
 const impulse=get('csd_impulsa_ruta_inicio_v2',sessionStorage);
 const common=get('csd_identificacion_sesion_v1',sessionStorage);
 const initial=[sessionStorage.getItem(identityKey),route?.email,impulse?.email,common?.email].find(validEmail)||'';
 const wrap=document.createElement('section');wrap.id='csdLevelSync';wrap.style.cssText='margin:14px 0;padding:16px;border:1px solid #4d829c;border-radius:15px;background:#112e48;color:#edf8ff';
 wrap.innerHTML='<label for="csdLevelEmail" style="display:block;font-weight:750;margin-bottom:7px;color:#effaff">Correo institucional para seguimiento de evaluaciones</label><input id="csdLevelEmail" type="email" autocomplete="email" style="width:100%;padding:11px;border:1px solid #73b6cd;border-radius:9px;background:#f8fcff;color:#102c42" placeholder="nombre@alumnos.ipg.cl"><p style="margin:8px 0;color:#cce3f3">Si ingresaste desde CSD Impulsa, el correo se recuperará automáticamente. Puedes estudiar sin identificarte, pero para registrar tus resultados en Dirección necesitas indicar un correo institucional. No se requiere RUT.</p><p id="csdLevelStatus" role="status" aria-live="polite" style="color:#c2e8f2">Resultados de las unidades disponibles para seguimiento.</p>';
 const host=document.querySelector('#tabs');
 if(host)host.parentNode.insertBefore(wrap,host);
 else document.querySelector('main')?.prepend(wrap);
 const emailInput=wrap.querySelector('#csdLevelEmail'),status=wrap.querySelector('#csdLevelStatus');
 emailInput.value=initial;
 const pending=()=>get(outboxKey,sessionStorage)||[];
 const setStatus=(s,error=false)=>{status.textContent=s;status.style.color=error?'#ffc4c4':'#c2e8f2'};
 let syncing=false;
 async function flush(){
  if(syncing)return;
  const email=emailInput.value.trim().toLowerCase(),list=pending();
  if(!list.length){if(validEmail(email))setStatus('Identificación disponible para registrar los próximos tests.');return}
  if(!validEmail(email)){setStatus('Resultado guardado en esta sesión. Indica un correo IPG válido para sincronizarlo con Dirección.',true);return}
  syncing=true;sessionStorage.setItem(identityKey,email);
  try{
   let events=pending();
   while(events.length){
    const event=events[0],body={p_event_id:event.id,p_email:email,p_modulo:moduleName,p_sesion:sid,p_evento:'evaluacion',p_unidad:event.unit,p_puntaje:event.score,p_intento:event.attempt,p_avance:event.progress};
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',apikey:anon,Authorization:'Bearer '+anon},body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok||data?.ok!==true)throw Error('HTTP '+response.status);
    events=events.slice(1);sessionStorage.setItem(outboxKey,JSON.stringify(events));
   }
   setStatus('✓ Resultados sincronizados con el Dashboard de Dirección (identidad declarada).');
  }catch(e){setStatus('No fue posible sincronizar ahora. Resultado conservado en esta sesión; reintenta cuando tengas conexión.',true)}
  finally{syncing=false}
 }
 emailInput.addEventListener('change',flush);
 emailInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();flush()}});
 const retry=document.createElement('button');retry.type='button';retry.textContent='Sincronizar resultados pendientes';retry.style.cssText='margin-top:8px;padding:9px 12px;border-radius:9px;border:1px solid #65d6e6;background:#13536c;color:#fff;font-weight:700;cursor:pointer';
 retry.onclick=flush;wrap.append(retry);
 function record(unit,score){
  const counts=get(countsKey,sessionStorage)||{};
  counts[unit]=(counts[unit]||0)+1;sessionStorage.setItem(countsKey,JSON.stringify(counts));
  const rand=crypto.randomUUID?crypto.randomUUID():'ev-'+Date.now()+'-'+Math.random().toString(36).slice(2,12);
  const events=pending();
  events.push({id:rand.replace(/[^a-zA-Z0-9_-]/g,''),unit,score,attempt:counts[unit],progress:Math.round(Object.keys(typeof scores==='object'?scores:{}).length/3*100)});
  sessionStorage.setItem(outboxKey,JSON.stringify(events));
  return flush();
 }
 window.CSDLevelTracking={record,flush,getModule:()=>moduleName};
 if(pending().length)flush();
})();