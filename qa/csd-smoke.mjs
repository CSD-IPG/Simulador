import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const base='https://csd-ipg.github.io/Simulador/';
const entries=[
'impulsa','nivelacion-matematica','refuerzo-tecnologias','refuerzo-lectura',
'wms','comex','portsim','finanzas','rrhh','marketing','matematica-financiera',
'segmentacion','plan-negocios','gestion-tributaria','estado-financiero',
'contabilidad-costos','bases-proyectos','integrado','repositorio',
'formacion-humana','politicas-publicas','convivencia-buen-trato',
'fundamentos-contables','nivelacion-matematica-2','refuerzo-tecnologias-2','refuerzo-lectura-2'
];
const levels=new Set(['refuerzo-tecnologias','refuerzo-lectura','nivelacion-matematica-2','refuerzo-tecnologias-2','refuerzo-lectura-2']);
const results=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for(const id of entries){
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.addInitScript(()=>{
   localStorage.setItem('csd_impulsa_ruta_iniciada_v2',JSON.stringify({version:2,started:true,attemptId:'a541af2e-4a44-4bb3-82f3-3401290be121',email:'qa.automatizada@alumnos.ipg.cl',timestamp:Date.now()}));
 });
 const page=await context.newPage(),errors=[],rpc=[];
 page.on('pageerror',err=>errors.push(err.message));
 if(levels.has(id)){
  await page.route('**/rest/v1/rpc/registrar_resultado_csd_v2',route=>{
   try{rpc.push(route.request().postDataJSON());}catch{}
   return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
  });
 }
 let result={id,status:'passed',steps:[],errors:[]};
 try{
  const response=await page.goto(base+id+'/?qa='+Date.now(),{waitUntil:'domcontentloaded',timeout:25000});
  if(!response||!response.ok())throw Error('HTTP '+(response?.status()||'sin respuesta'));
  await page.waitForTimeout(500);
  const title=await page.title();
  if(!title.trim())throw Error('Sin título de documento');
  result.steps.push('HTTP '+response.status()+' y título');
  if(levels.has(id)){
   await page.waitForFunction(()=>!!window.CSDLevelTracking,{timeout:9000});
   const privacy=page.locator('#csdPrivacyGate');
   if(await privacy.count() && await privacy.isVisible()){
    await privacy.locator('input[type="checkbox"]').check();
    await privacy.getByRole('button',{name:'Aceptar y continuar'}).click();
   }
   await page.locator('#csdLevelEmail').fill('qa.automatizada@alumnos.ipg.cl');
   for(let unit=0;unit<3;unit++){
    await page.locator('#tabs button').nth(unit).click();
    const correct=await page.evaluate(()=>units[current][2].map(q=>q[2]));
    for(let i=0;i<correct.length;i++)await page.locator('#quiz input[name="q'+i+'"][value="'+correct[i]+'"]').check();
    await page.locator('#quiz button[type="submit"]').click();
    await page.waitForTimeout(200);
   }
   await page.waitForTimeout(400);
   if(rpc.length!==3)throw Error('RPC interceptados '+rpc.length+'/3');
   if(rpc.some((r,i)=>r.p_unidad!==i+1||r.p_puntaje!==100||r.p_evento!=='evaluacion'))throw Error('Payload inconsistente en test por unidad');
   result.steps.push('3 unidades evaluadas con 100% y 3 envíos RPC interceptados');
  }
  if(errors.length)throw Error('Errores JavaScript: '+errors.slice(0,3).join(' | '));
 }catch(e){result.status='failed';result.errors.push(String(e.message||e));}
 results.push(result);
 console.log(result.status.toUpperCase(),id,result.steps.join('; '),result.errors.join('; '));
 await context.close();
}
// Dashboard: prueba de representación con registros sintéticos, sin autenticación real
// ni acceso a datos privados. El control de acceso se verifica en Supabase.
{
 const page=await browser.newPage();let result={id:'dashboard-representacion',status:'passed',steps:[],errors:[]};
 try{
  const response=await page.goto(base+'escuela/?qa='+Date.now(),{waitUntil:'domcontentloaded',timeout:25000});
  if(!response?.ok())throw Error('HTTP '+response?.status());
  const r=await page.evaluate(()=>{
   const fake={fecha:new Date().toISOString(),email_declarado:'prueba.dashboard@alumnos.ipg.cl',modulo:'Office básico · Nivelación 1',sesion:'qa',evento:'evaluacion',unidad:1,puntaje:90,intento:1,avance:33};
   CSD_REF_ROWS=[fake];renderNivelaciones();
   return {people:document.getElementById('nivelPersonas').textContent,tests:document.getElementById('nivelEvaluaciones').textContent,avg:document.getElementById('nivelPromedio').textContent,rows:document.querySelectorAll('#nivelTbody tr').length};
  });
  if(r.people!=='1'||r.tests!=='1'||r.avg!=='90.0%'||r.rows!==1)throw Error('Métricas o renderización incorrectas: '+JSON.stringify(r));
  result.steps.push('Dashboard representa correctamente resultado sintético, KPIs y tabla; datos institucionales no consultados');
 }catch(e){result.status='failed';result.errors.push(String(e.message||e))}
 results.push(result);
 console.log(result.status.toUpperCase(),result.id,result.steps.join('; '),result.errors.join('; '));
 await page.close();
}
await browser.close();
const summary={timestamp:new Date().toISOString(),tested:results.length,passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length,results};
await fs.mkdir('qa-results',{recursive:true});
await fs.writeFile('qa-results/report.json',JSON.stringify(summary,null,2));
console.log('RESUMEN',JSON.stringify({tested:summary.tested,passed:summary.passed,failed:summary.failed}));
if(summary.failed)process.exitCode=1;
