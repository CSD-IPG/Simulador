import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const base='https://csd-ipg.github.io/Simulador/';
const modules=['impulsa','nivelacion-matematica','refuerzo-tecnologias','refuerzo-lectura','wms','comex','portsim','finanzas','rrhh','marketing','matematica-financiera','segmentacion','plan-negocios','gestion-tributaria','estado-financiero','contabilidad-costos','bases-proyectos','integrado','repositorio','formacion-humana','politicas-publicas','convivencia-buen-trato','fundamentos-contables','nivelacion-matematica-2','refuerzo-tecnologias-2','refuerzo-lectura-2'];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
for(const id of modules){
 const page=await browser.newPage({viewport:{width:1365,height:950}});
 let issue=null;
 try{
  const response=await page.goto(base+id+'/?contrast='+Date.now(),{waitUntil:'domcontentloaded',timeout:25000});
  if(!response?.ok())throw Error('HTTP '+response?.status());
  if(['matematica-financiera','contabilidad-costos','bases-proyectos'].includes(id)){
   await page.evaluate(()=>document.body.classList.add('ipg-auth-ok'));
   const tab=page.locator('.tab[data-v="u1"]');
   if(await tab.count())await tab.click({force:true,timeout:2500});
  }
  await page.waitForTimeout(350);
  if(id==='matematica-financiera'){await fs.mkdir('qa-results',{recursive:true});await page.screenshot({path:'qa-results/matematica-financiera-unidad1.png',fullPage:true});}
  issue=await page.evaluate(()=>{
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
 }catch(e){issue=[{error:e.message}]}
 results.push({id,issues:issue});
 console.log(id,(issue||[]).length,JSON.stringify((issue||[]).slice(0,8)));
 await page.close();
}
await browser.close();
await fs.mkdir('qa-results',{recursive:true});
await fs.writeFile('qa-results/contrast.json',JSON.stringify({total:results.length,results},null,2));
