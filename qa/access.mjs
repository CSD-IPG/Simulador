import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const modules=['wms','comex','portsim','finanzas','rrhh','marketing','integrado','contabilidad-costos','bases-proyectos','formacion-humana'];
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
  await page.locator(module==='contabilidad-costos'?'#authEmail':module==='formacion-humana'?'#email':'#ipgAuthEmail').fill('prueba@ipg.cl');
  if(perfil!=='colaborador')await page.locator('#csdRut').fill('12.345.678-0');
  if(perfil==='estudiante')await page.locator('#csdCarrera').selectOption('EGNM-01');
  else if(await page.locator('#csdCarreraWrap').isVisible())throw Error('Carrera visible para '+perfil);
  await page.locator(module==='contabilidad-costos'?'#authLogin':module==='formacion-humana'?'#enter':'#ipgAuthLogin').click();
  await page.waitForFunction(m=>m==='contabilidad-costos'?document.body.classList.contains('auth-ok'):m==='formacion-humana'?getComputedStyle(document.getElementById('login')).display==='none':document.body.classList.contains('ipg-auth-ok'),module,{timeout:10000});
  const ident=writes.find(x=>x.url.includes('registrar_identificacion_csd'))?.data;
  if(!ident||ident.p_perfil!==perfil||ident.p_carrera_codigo!==(perfil==='estudiante'?'EGNM-01':null))throw Error('Identificación incorrecta');

  const ids=module==='wms'?['loginName','loginId','loginCareer']:module==='comex'?['stName','stId','stCareer']:module==='formacion-humana'?['name','career']:['student','studentId','career'];
  for(const id of ids){const el=page.locator('#'+id);if(await el.count()){if(await el.isVisible())throw Error('Dato personal repetido: '+id);const value=await el.inputValue();if(!value)throw Error('Dato no reutilizado: '+id);}}
  if(module==='wms'){
   await page.locator('#loginSection').fill('Sección de prueba');
   await page.locator('#loginActivity').fill('Gestión logística');
   await page.locator('#loginTeacher').fill('Docente de prueba');
   await page.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
   await page.waitForFunction(()=>!document.getElementById('simApp').classList.contains('hidden'));
   if(await page.evaluate(()=>state.meta.name)!=='Prueba local de acceso')throw Error('Nombre no transferido a la sesión');
   if(perfil==='estudiante'){
    await fs.mkdir('qa-results',{recursive:true});
    const views=await page.locator('#nav button[data-view]').evaluateAll(els=>els.map(x=>x.dataset.view));
    for(const view of views){await page.evaluate(v=>show(v),view);await page.waitForTimeout(60);
     const issues=await page.evaluate(()=>{
   function parse(color){
    if(!color||color==='transparent')return null;
    let m=color.match(/^rgba?\(([\d.,\s]+)\)$/);
    if(!m)return null;
    let nums=m[1].split(/[, ]+/).filter(Boolean).map(Number);
    if(nums.length<3)return null;
    return [...nums.slice(0,3),nums[3]??1];
   }
   function luminance(rgb){
    const a=rgb.slice(0,3).map(v=>{let n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});
    return .2126*a[0]+.7152*a[1]+.0722*a[2];
   }
   function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
   function bg(el){
    let stack=[];for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n),c=parse(s.backgroundColor);if(c&&c[3]>0.15){stack.push(c);if(c[3]>=.99)break}}
    let val=[9,26,44];
    for(let i=stack.length-1;i>=0;i--){const [r,g,b,a]=stack[i];val=[r*a+val[0]*(1-a),g*a+val[1]*(1-a),b*a+val[2]*(1-a)]}
    return val;
   }
   const list=[];
   const sel='h1,h2,h3,h4,p,small,label,summary,button,a,th,td,li,.sub,.muted,.formula,.note,.guide-head,.badge,.pill';
   for(const el of document.querySelectorAll(sel)){
    const r=el.getBoundingClientRect(),style=getComputedStyle(el);
    if(r.width<5||r.height<6||r.bottom<0||r.top>innerHeight*3||style.visibility==='hidden'||style.display==='none'||Number(style.opacity)<.5)continue;
    if(el.closest('[aria-hidden="true"]')||el.closest('script,style'))continue;
    const txt=(el.innerText||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,90);
    if(!txt)continue;
    const fg=parse(style.color);if(!fg)continue;
    const background=bg(el),score=contrast(fg,background);
    if(score>=4.5)continue;
    list.push({node:el.tagName,selector:(el.id?'#'+el.id:el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).join('.'):el.tagName.toLowerCase()),text:txt,ratio:+score.toFixed(2),fg:style.color,bg:background.map(Math.round).join(','),scope:el.closest('.guide-head,.guide-body,.quiz,.hero,.panel,.ipg-auth-card,.notice,.card,.note')?.className||''});
   }
   return list.sort((a,b)=>a.ratio-b.ratio).slice(0,30);
  });
     if(issues.length)throw Error('Contraste '+view+': '+JSON.stringify(issues.slice(0,5)));
    }
    await page.evaluate(()=>show('dashboard'));
    await page.screenshot({path:'qa-results/wms-interior.png',fullPage:true});
   }
  }
  console.log('PASS',module,perfil,'identificación reutilizada');

 }catch(e){failures++;console.error('FAIL',module,perfil,e.message)}
 await context.close();
}
await browser.close();
if(failures)process.exitCode=1;
