/* CSD: telemetría de procesos sin datos personales. El envío exige sesión Supabase Auth real. */
(function(){
 const moduleId=document.currentScript?.dataset?.module||'';
 const known={
  wms:['recepcion','acta recepcion','picking','packing','despacho','contingencia','cierre'],
  portsim:['gate','yard','vessel','retiro','contingencia'],
  finanzas:['presupuesto','resultados','caja','forecast','kpi','contingencia'],
  rrhh:['ficha','asistencia','remuneracion','desempeno','analytics','contingencia'],
  marketing:['crm','funnel','campana','analytics','contingencia'],
  integrado:['marketing','comex','puerto','wms','finanzas','personas','integracion']
 };
 const clean=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const sid='csdp_'+moduleId;
 let session=sessionStorage.getItem(sid);
 if(!session){session=crypto.randomUUID();sessionStorage.setItem(sid,session)}
 window.csdRecordProcess=async function(type,delta){
   const process=clean(type);
   if(!(known[moduleId]||[]).includes(process))return false;
   // Este token solo podrá provenir de un inicio de sesión real con Supabase Auth.
   const token=window.CSD_VERIFIED_SUPABASE_ACCESS_TOKEN;
   if(!token||typeof token!=='string')return false;
   const score=Number(delta);
   const payload={sesion_id:session,modulo_id:moduleId,proceso_id:process,tipo_evento:score<0?'error':score>0?'acierto':'accion',puntaje_delta:Number.isFinite(score)?Math.max(-1000,Math.min(1000,score)):null};
   try{const r=await fetch('https://uegxxazgqvjjqnmpodln.supabase.co/rest/v1/eventos_proceso_csd',{method:'POST',headers:{apikey:document.querySelector('[data-csd-publishable-key]')?.dataset.csdPublishableKey||window.CSD_SUPABASE_PUBLISHABLE_KEY||'',Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload)});return r.ok}catch(_){return false}
 };
})();