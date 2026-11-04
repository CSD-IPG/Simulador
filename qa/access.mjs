import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const modules=['wms','comex','portsim','finanzas','rrhh','marketing','integrado'];
let failures=0;
for(const module of modules)for(const perfil of ['estudiante','docente','colaborador']){
 const context=await browser.newContext();const page=await context.newPage();const writes=[];
 await page.route('**/rest/v1/**',async route=>{
  const req=route.request();
  if(req.method()==='POST'){writes.push({url:req.url(),data:req.postDataJSON()});return route.fulfill({status:200,contentType:'application/json',body:req.url().includes('registrar_identificacion_csd')?'true':'{"ok":true}'});}
  if(req.url().includes('catalogo_carreras_csd'))return route.fulfill({status:200,contentType:'application/json',body:'[{"codigo":"EGNM-01","nombre":"Administración Pública"}]'});
  return route.continue();
 });
 try{
  await page.goto('http://127.0.0.1:8765/'+module+'/',{waitUntil:'networkidle'});
  if(await page.locator('#csdPrivacyGate').isVisible()){await page.locator('#csdPrivacyGate input').check();await page.locator('#csdPrivacyGate button').click();}
  await page.locator('#csdPerfil').selectOption(perfil);
  await page.locator('#csdNombre').fill('Prueba local de acceso');
  await page.locator('#ipgAuthEmail').fill('prueba@ipg.cl');
  if(perfil!=='colaborador')await page.locator('#csdRut').fill('12.345.678-0');
  if(perfil==='estudiante')await page.locator('#csdCarrera').selectOption('EGNM-01');
  else if(await page.locator('#csdCarreraWrap').isVisible())throw Error('Carrera visible para '+perfil);
  await page.locator('#ipgAuthLogin').click();
  await page.waitForFunction(()=>document.body.classList.contains('ipg-auth-ok'),{timeout:10000});
  const ident=writes.find(x=>x.url.includes('registrar_identificacion_csd'))?.data;
  if(!ident||ident.p_perfil!==perfil||ident.p_carrera_codigo!==(perfil==='estudiante'?'EGNM-01':null))throw Error('Identificación incorrecta');
  console.log('PASS',module,perfil);
 }catch(e){failures++;console.error('FAIL',module,perfil,e.message)}
 await context.close();
}
await browser.close();
if(failures)process.exitCode=1;
