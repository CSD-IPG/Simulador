import {SUPABASE_URL,ANON_KEY} from './config.js';
import {parseWorkbook,analyze,suggestedAction,gradeLabels,gradeStatus} from './analysis.js';
const $=id=>document.getElementById(id);
const html=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>n==null?'—':Number(n).toLocaleString('es-CL');
const pct=n=>n==null?'—':(100*n).toLocaleString('es-CL',{maximumFractionDigits:1})+' %';
const options=(items,selected='')=>items.map(v=>{const [value,label]=Array.isArray(v)?v:[v,v];return '<option value="'+html(value)+'" '+(String(value)===String(selected)?'selected':'')+'>'+html(label)+'</option>'}).join('');
const periodName=p=>p?'Ciclo '+Number(p.slice(5))+' de '+p.slice(0,4):'';
const table=(headers,rows)=>'<div class="scroll"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+html(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const metric=(n,label,detail)=>'<article class="metric"><small>'+html(label)+'</small><strong>'+html(n)+'</strong><small>'+html(detail)+'</small></article>';
const unique=items=>[...new Set(items.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es',{numeric:true}));
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let token=sessionStorage.getItem('seguimiento_token')||sessionStorage.getItem('csd_token')||'',user,model,period='',tab='dashboard',preview,request=0,caseRut='',page=0,subjectPage=0;
let filters={},caseFilters={},pendingId='',alertItems=[];
const admin=()=>user?.role==='Dirección';
const staffName=v=>({'catalina.roman@ipg.cl':'Catalina Román','nicolas.cabrera@ipg.cl':'Nicolás Cabrera','matias.guerrero@ipg.cl':'Matías Guerrero','nayaret.mendez@ipg.cl':'Nayaret Méndez','nidia.olavarria@ipg.cl':'Nidia Olavarría'}[v]||v||'Sin asignar');
function status(msg='',bad=false){$('alert').textContent=msg;$('alert').className=bad?'error':'';}
function showLogin(){request++;alertItems=[];user=null;model=null;preview=null;caseRut='';$('content').replaceChildren();$('caseDetail').replaceChildren();$('preview').replaceChildren();for(const d of document.querySelectorAll('dialog[open]'))d.close();$('app').hidden=true;$('login').hidden=false;}
async function jsonRequest(path,body,auth=''){
 const headers={'Content-Type':'application/json',apikey:ANON_KEY};if(auth)headers.Authorization='Bearer '+auth;
 let resp;try{resp=await fetch(SUPABASE_URL+path,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'})}catch{throw Error('No se pudo conectar con el servidor de la Escuela. Revise la conexión y reintente.')}
 const j=await resp.json().catch(()=>({}));if(!resp.ok){if(auth&&auth===token&&resp.status===403&&j.message==='La cuenta no tiene acceso al seguimiento'){sessionStorage.removeItem('seguimiento_token');sessionStorage.removeItem('csd_token');token='';showLogin();throw Error('La cuenta no tiene acceso al seguimiento. Consulte con la Dirección.')}if(auth&&resp.status===401){sessionStorage.removeItem('seguimiento_token');sessionStorage.removeItem('csd_token');token='';showLogin();throw Error('La sesión terminó. Ingrese nuevamente.')}throw Error(j.error_code==='invalid_credentials'?'El correo o la clave no coinciden.':j.message||j.msg||j.error_description||'La operación no pudo completarse.')}return j;
}
const api=(accion,datos={})=>jsonRequest('/rest/v1/rpc/seguimiento_academico',{accion,datos},token);
function fail(e){status(e?.message||String(e),true);}
async function busy(btn,fn){if(btn?.disabled)return;if(btn)btn.disabled=true;try{await fn()}catch(e){fail(e);const d=document.querySelector('dialog[open]');if(d){let a=d.querySelector('.dialog-error');if(!a){a=document.createElement('p');a.className='alert error dialog-error';a.setAttribute('role','alert');d.prepend(a)}a.textContent=e.message}}finally{if(btn)btn.disabled=false}}
function cleanDialog(d){d.querySelector('.dialog-error')?.remove()}
const fragment = new URLSearchParams(location.hash.slice(1));
let activationCode = fragment.get('activar') || '';
if (fragment.has('activar')) history.replaceState(null, '', location.pathname + location.search);
function configureSignIn() {
 const activating = Boolean(activationCode);
 $('activationNote').hidden = !activating;
 $('activationNote').textContent = activating ? 'Use el correo que la Dirección habilitó. Si ya tiene una cuenta del CSD, ingrese su clave habitual. Si es nueva, elija una clave personal de al menos ocho caracteres.' : '';
 $('passwordLabel').textContent = activating ? 'Clave habitual o nueva clave personal' : 'Clave personal';
 $('signinButton').textContent = activating ? 'Activar e ingresar' : 'Ingresar';
 $('firstAccess').hidden = activating;
}
configureSignIn();
$('signin').onsubmit=e=>{
 e.preventDefault();
 busy(e.submitter,async()=>{
  const email=$('email').value.trim(),password=$('password').value,creds={email,password};
  let session;
  if(activationCode){
   const mode=await jsonRequest('/rest/v1/rpc/preparar_acceso_seguimiento',{correo:email,codigo:activationCode});
   if(mode!=='existente'&&mode!=='nueva')throw Error('Revise el correo. Si el enlace venció o fue reemplazado, solicite uno nuevo a la Dirección.');
   if(mode==='nueva'){
    if(password.length<8)throw Error('Elija una clave de al menos ocho caracteres.');
    session=await jsonRequest('/auth/v1/signup',creds);
    if(!session.access_token){$('password').value='';status('Revise su correo de confirmación. Luego vuelva a abrir este enlace para ingresar con su clave.');return;}
   }else{
    session=await jsonRequest('/auth/v1/token?grant_type=password',creds);
   }
   await jsonRequest('/rest/v1/rpc/seguimiento_academico',{accion:'vincular',datos:{codigo:activationCode}},session.access_token);
   activationCode='';configureSignIn();
  }else{
   session=await jsonRequest('/auth/v1/token?grant_type=password',creds);
  }
  token=session.access_token;
  $('password').value='';
  await start();
  sessionStorage.setItem('seguimiento_token',token);
 });
};
$('logout').onclick=()=>{const previousToken=token;sessionStorage.removeItem('seguimiento_token');sessionStorage.removeItem('csd_token');token='';showLogin();status('Sesión cerrada.');if(previousToken)fetch(SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:ANON_KEY,Authorization:'Bearer '+previousToken}}).catch(()=>{})};
async function start(preferred=period){
 const oldRole=user?.role;user=await api('inicio');if(!oldRole)tab=admin()?'dashboard':'cases';if(!admin())tab='cases';
 $('login').hidden=true;$('app').hidden=false;$('identity').textContent=user.role+' · '+user.email;document.querySelectorAll('[data-admin]').forEach(n=>n.hidden=!admin());
 const periods=user.periods||[];$('period').innerHTML=periods.length?options(periods.map(p=>[p.period,periodName(p.period)]),preferred):'<option>Sin cierres disponibles</option>';
 $('period').disabled=!periods.length;await load(periods.some(p=>p.period===preferred)?preferred:periods[0]?.period||'');
}
async function load(p){
 const stamp=++request;model=null;period=p;page=0;subjectPage=0;filters={};caseFilters={};status();$('content').innerHTML='<div class="loading">Cargando cierre…</div>';
 if(p){$('period').value=p;const raw=await api('leer',{periodo:p});if(stamp!==request)return;
  const current={...raw,year:+p.slice(0,4),cycle:+p.slice(5),analysis:analyze(raw.rows),previous:null};model=current;
  const prior=admin()&&user.periods.find(x=>x.period<p);
  if(prior){try{const prev=await api('leer',{periodo:prior.period});if(stamp!==request)return;current.previous={year:+prior.period.slice(0,4),cycle:+prior.period.slice(5),analysis:analyze(prev.rows),rows:prev.rows}}catch(e){if(stamp!==request)return;status('No se pudo cargar la comparación histórica. '+e.message,true)}}
 }if(stamp===request){await loadAlerts().catch(()=>{});if(stamp===request)render();}
}
$('period').onchange=e=>load(e.target.value).catch(fail);$('reload').onclick=e=>busy(e.currentTarget,()=>start());
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('tabs').onclick=e=>{const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;render()}};
function render(){if(!user)return;document.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-current',String(x.dataset.tab===tab)));
 if(tab==='team'&&admin())return drawTeam();
 if(tab==='alerts')return drawAlerts();
 if(!model){$('content').innerHTML='<div class="card empty"><h2>'+(admin()?'Aún no hay un cierre cargado':'Sin fichas asignadas')+'</h2><p>'+(admin()?'Use «Cargar cierre» para validar el consolidado de notas de U+ e iniciar el análisis.':'Las fichas aparecerán cuando la Dirección le asigne estudiantes.')+'</p></div>';return}
 if(tab==='dashboard'&&admin())drawDash();else if(tab==='exports'&&admin())drawExports();else drawCases();
}
async function loadAlerts(){const actor=token;const data=await api('alertas');if(actor!==token||!user)return;alertItems=data.items||[];const b=$('alertTab');if(b){const n=alertItems.filter(a=>!a.read).length;b.textContent='🔔 Notificaciones'+(n?' ('+n+')':'');}}
function drawAlerts(){
 const list=alertItems;
 const rows=list.map(a=>[html(a.date),html(periodName(a.period)),html(a.type),fmt(a.count),a.read?'Leída':'<button class="secondary" data-read="'+html(a.id)+'">Marcar leída</button>','<button class="secondary" data-alert-period="'+html(a.period)+'" data-alert-type="'+html(a.type)+'">Ver seguimiento</button>']);
 $('content').innerHTML='<section class="card"><h2>Centro de notificaciones</h2><p>Alertas consolidadas por fecha y ciclo, con acceso a las fichas autorizadas. El historial conserva los avisos anteriores; consulte el seguimiento para comprobar su estado actual.</p><button id="refreshAlerts" class="secondary">Actualizar notificaciones</button></section><div class="metrics">'+metric(fmt(list.filter(a=>!a.read).length),'Sin leer','Avisos registrados')+metric(fmt(list.length),'Historial','Últimos 150 avisos')+'</div><section class="card">'+(rows.length?table(['Fecha','Ciclo','Tipo de alerta','Casos','Lectura','Acción'],rows):'<p>No hay alertas registradas.</p>')+'</section>';
 $('refreshAlerts').onclick=e=>busy(e.currentTarget,async()=>{await loadAlerts();drawAlerts()});
 $('content').querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>busy(b,async()=>{await api('leer_alerta',{id:Number(b.dataset.read)});await loadAlerts();drawAlerts()}));
 $('content').querySelectorAll('[data-alert-period]').forEach(b=>b.onclick=()=>busy(b,async()=>{const p=b.dataset.alertPeriod;tab='cases';await load(p);if(model){caseFilters.deadline=b.dataset.alertType.includes('vencidos')||b.dataset.alertType.includes('Escalamiento')?'Vencido':b.dataset.alertType.includes('de hoy')?'Hoy':b.dataset.alertType.includes('Próximos')?'Próximo':'';drawCases()}}));
}
const select=(id,label,list,first,selected)=>'<label>'+html(label)+'<select id="'+id+'">'+options([['',first],...list],selected)+'</select></label>';
function filtered(rows){return rows.filter(r=>(!filters.career||r.careerCode===filters.career)&&(!filters.subject||r.subjectCode===filters.subject)&&(!filters.section||String(r.section)===filters.section))}
function drawDash(){
 const rows=model.rows;const byCareer=rows.filter(r=>!filters.career||filters.career===r.careerCode),bySubject=byCareer.filter(r=>!filters.subject||r.subjectCode===filters.subject);
 const a=Object.values(filters).some(Boolean)?analyze(filtered(rows)):model.analysis,s=a.summary;
 const careerOptions=model.analysis.careers.map(g=>[g.careerCode,g.career]).sort((a,b)=>a[1].localeCompare(b[1],'es'));
 const subOptions=[...new Map(byCareer.map(r=>[r.subjectCode,r.subject])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es'));
 const bars=[['Aprobaron',s.passed],['Rindieron y reprobaron',s.failed],['No rindieron',s.notTaken],['Sin participación',s.absent]].map(([label,n])=>'<div><span>'+label+'</span><div class="track"><i style="width:'+(s.total?100*n/s.total:0)+'%"></i></div><b>'+fmt(n)+'</b></div>').join('');
 const ps=model.previous&&(Object.values(filters).some(Boolean)?analyze(filtered(model.previous.rows)).summary:model.previous.analysis.summary);
 const comp=ps?table(['Indicador','Ciclo '+model.previous.cycle+' · '+model.previous.year,'Ciclo '+model.cycle+' · '+model.year],[['Inscripciones',fmt(ps.total),fmt(s.total)],['Cobertura de rendición',pct(ps.coverage),pct(s.coverage)],['Aprobación entre evaluados',pct(ps.approval),pct(s.approval)],['Estudiantes a contactar',fmt(ps.atRisk),fmt(s.atRisk)]]):'<p class="muted">La comparación aparecerá al cargar un cierre anterior.</p>';
 $('content').innerHTML='<div class="card filters">'+select('fcareer','Carrera',careerOptions,'Todas las carreras',filters.career)+select('fsubject','Asignatura',subOptions,'Todas las asignaturas',filters.subject)+select('fsection','Sección',unique(bySubject.map(r=>r.section)),'Todas las secciones',filters.section)+'</div><div class="metrics">'+metric(fmt(s.total),'Inscripciones',fmt(s.students)+' estudiantes únicos')+metric(pct(s.approval),'Aprobación entre evaluados',fmt(s.passed)+' de '+fmt(s.evaluated)+' evaluados')+metric(pct(s.coverage),'Cobertura de rendición',fmt(s.evaluated)+' de '+fmt(s.total)+' inscripciones')+metric(fmt(s.atRisk),'Estudiantes a contactar',fmt(s.highRisk)+' con tres o más sin aprobar')+'</div><div class="two"><section class="card"><h2>Participación y desempeño</h2><div class="bars">'+bars+'</div></section><section class="card"><h2>Comparación entre cierres</h2>'+comp+'</section></div><section class="card"><div class="panel-head"><h2>Asignaturas por carrera</h2>'+select('signal','Semáforo',unique(a.subjects.map(g=>g.status)),'Todos',filters.signal)+'</div><p class="small muted">La aprobación se calcula entre quienes rindieron. Una baja cobertura puede coexistir con una alta aprobación.</p><div id="subjectList"></div></section>';
 ['career','subject','section'].forEach(k=>$('f'+k).onchange=e=>{filters[k]=e.target.value;if(k==='career')filters.subject='';if(k!=='section')filters.section='';filters.signal='';subjectPage=0;drawDash()});
 const display=()=>{const groups=a.subjects.filter(g=>!filters.signal||g.status===filters.signal),per=30;
 $('subjectList').innerHTML=table(['Asignatura','Carrera','Semáforo','Meta','Inscritos','Rindieron','Aprobación','Cobertura','Cierres por revisar'],groups.slice(subjectPage*per,(subjectPage+1)*per).map(g=>[html(g.subject),html(g.career),'<span class="tag '+(g.status.startsWith('Rojo')?'red':g.status==='Amarillo'?'yellow':g.status==='Verde'?'green':'')+'">'+html(g.status)+'</span>',pct(g.target),fmt(g.total),fmt(g.evaluated),pct(g.approval),pct(g.coverage),fmt(g.review)]))+pager('s',groups.length,subjectPage,per);bindPager('s',step=>{subjectPage+=step;display()})};
 $('signal').onchange=e=>{filters.signal=e.target.value;subjectPage=0;display()};display();
}
function pager(id,total,p,per){return '<div class="pager"><button id="'+id+'back" class="secondary" '+(!p?'disabled':'')+'>Anterior</button><small>'+ (total?fmt(p*per+1)+'–'+fmt(Math.min((p+1)*per,total))+' de '+fmt(total):'0 resultados')+'</small><button id="'+id+'next" class="secondary" '+((p+1)*per>=total?'disabled':'')+'>Siguiente</button></div>'}
function bindPager(id,fn){$(id+'back').onclick=()=>fn(-1);$(id+'next').onclick=()=>fn(1)}
const todayCL=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function followDate(csd=false){const d=new Date(todayCL()+'T12:00:00Z');if(csd)d.setUTCDate(d.getUTCDate()+28);else for(let n=0;n<5;){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)n++}return d.toISOString().slice(0,10)}
function deadline(t){if(t?.closed)return 'Cerrado';if(!t?.due)return 'Sin programar';const now=todayCL();if(t.due<now)return 'Vencido';if(t.due===now)return 'Hoy';const d=new Date(now+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+2);return t.due<=d.toISOString().slice(0,10)?'Próximo':'Vigente'}
const stateOf=t=>t?.closed?'Cerrado':t?.events?.[0]?.outcome||'Pendiente';
function allCases(){return [...model.analysis.cases,...Object.entries(model.tracking).filter(([,t])=>!t.active).map(([rut,t])=>({rut,name:t.name,career:t.career,risk:'Archivo',affected:0,subjects:[]}))]}
function drawCases(){
 const all=allCases();
 const specific=caseFilters.group==='participacion';
 const closedOnly=caseFilters.group==='cerradas';
 const pool=closedOnly?all.filter(c=>model.tracking[c.rut]?.closed):specific?all.filter(c=>c.absent>0||c.notTaken>0):all.filter(c=>!model.tracking[c.rut]?.closed);
 const groups=[['todas','Todas las fichas'],['participacion','Contacto por notas 0,0 y 1,0'],['cerradas','Casos cerrados']];
 const groupButtons=groups.map(([key,label])=>'<button type="button" data-group="'+key+'" aria-current="'+(key===(specific?'participacion':closedOnly?'cerradas':'todas'))+'">'+label+'</button>').join('');
 const motives=[['notTaken','No rindió evaluaciones (1,0)'],['absent','Sin participación (0,0)'],['both','Ambas situaciones']];
 const motiveFilter=specific?select('cMotive','Situación académica',motives,'Nota 0,0 o 1,0',caseFilters.motive):'';
 $('content').innerHTML='<nav id="caseGroups" aria-label="Vistas de seguimiento">'+groupButtons+'</nav><section class="card"><h2>'+(specific?'Contacto por notas 0,0 y 1,0':'Fichas de estudiantes')+'</h2>'+
  (specific?'<p>Una ficha por estudiante con al menos una asignatura con nota final 0,0 o 1,0. Abra el nombre para consultar o registrar un contacto.</p>':'')+
  '<div class="filters"><label>Buscar estudiante<input id="findCase" placeholder="Nombre o RUT" value="'+html(caseFilters.query)+'"></label>'+
  motiveFilter+select('cCareer','Carrera',unique(all.map(c=>c.career)),'Todas',caseFilters.career)+select('cRisk','Riesgo',unique(all.map(c=>c.risk)),'Todos',caseFilters.risk)+select('cState','Última gestión',['Pendiente','Intento sin respuesta','Contacto efectivo','Derivado','Cerrado'],'Todas',caseFilters.state)+select('cDeadline','Plazo',['Hoy','Próximo','Vencido','Vigente','Cerrado','Sin programar'],'Todos',caseFilters.deadline)+
  '</div></section><div class="metrics" id="contactMetrics"></div><section class="card"><div id="caseList"></div></section>';
 $('caseGroups').onclick=e=>{
  const button=e.target.closest('[data-group]');if(!button)return;
  caseFilters.group=button.dataset.group;caseFilters.motive='';caseFilters.state='';page=0;drawCases();
 };
 for(const k of ['Career','Risk','State','Deadline',...(specific?['Motive']:[])]){
  $('c'+k).onchange=e=>{caseFilters[k.toLowerCase()]=e.target.value;page=0;list()};
 }
 $('findCase').oninput=e=>{caseFilters.query=e.target.value;page=0;list()};
 function list(){
  const query=fold(caseFilters.query).replace(/[.\s-]/g,'');
  const items=pool.filter(c=>
   (!query||fold(c.name+' '+c.rut).replace(/[.\s-]/g,'').includes(query))&&
   (!caseFilters.career||c.career===caseFilters.career)&&(!caseFilters.risk||c.risk===caseFilters.risk)&&
   (!caseFilters.state||stateOf(model.tracking[c.rut])===caseFilters.state)&&(!caseFilters.deadline||deadline(model.tracking[c.rut])===caseFilters.deadline)&&
   (!specific||!caseFilters.motive||(caseFilters.motive==='both'?(c.absent>0&&c.notTaken>0):c[caseFilters.motive]>0)));
  const active=items.filter(c=>model.tracking[c.rut]?.active!==false&&!model.tracking[c.rut]?.closed);
  const count=key=>active.filter(c=>stateOf(model.tracking[c.rut])===key).length;
  const reached=active.filter(c=>model.tracking[c.rut]?.events?.some(e=>e.outcome==='Contacto efectivo')).length;
  $('contactMetrics').innerHTML=metric(fmt(active.length),admin()?'Estudiantes de la selección':'Mis estudiantes de la selección','Fichas vigentes')+
   metric(fmt(count('Pendiente')),'Pendientes','Sin intervenciones registradas')+metric(fmt(count('Intento sin respuesta')),'Intento sin respuesta','Según la última gestión')+metric(fmt(reached),'Con contacto efectivo','Contacto confirmado en el historial')+
   metric(fmt(all.filter(c=>model.tracking[c.rut]?.closed).length),'Casos cerrados','Excluidos de gestiones pendientes')+metric(fmt(active.filter(c=>deadline(model.tracking[c.rut])==='Hoy').length),'Seguimientos hoy','Fecha programada')+metric(fmt(active.filter(c=>deadline(model.tracking[c.rut])==='Vencido').length),'Seguimientos vencidos','Requieren gestión');
  const per=25;
  page=Math.min(page,Math.max(0,Math.ceil(items.length/per)-1));
  const rows=items.slice(page*per,(page+1)*per).map(c=>{
   const t=model.tracking[c.rut],last=t?.events?.[0];
   const date=last?.created_at?new Date(last.created_at).toLocaleDateString('es-CL',{timeZone:'America/Santiago'}):'';
   return ['<button class="textbtn" data-rut="'+html(c.rut)+'">'+html(c.name)+'</button>',html(c.career),html(c.risk),
    ...(specific?[fmt(c.absent),fmt(c.notTaken)]:[fmt(c.affected)]),html(staffName(t?.assignee)),html(staffName(t?.supervisor)),html(stateOf(t))+(date?'<br><small>'+html(date)+'</small>':''),html(t?.closed?'Caso cerrado':t?.due||last?.next_date||'—')+'<br><small style="font-weight:bold;color:'+({Vencido:'#b91c1c',Hoy:'#1d4ed8',Próximo:'#a16207',Vigente:'#15803d'}[deadline(t)]||'inherit')+'">'+html(deadline(t))+'</small>'];
  });
  const headers=['Estudiante','Carrera','Riesgo',...(specific?['Asignaturas con 0,0','Asignaturas con 1,0']:['Asignaturas sin aprobar']),'Responsable','Supervisor','Última gestión','Próximo seguimiento'];
  $('caseList').innerHTML=(rows.length?table(headers,rows):'<p class="empty">No hay estudiantes que coincidan con esta selección.</p>')+pager('c',items.length,page,per);
  bindPager('c',step=>{page+=step;list()});
  $('caseList').querySelectorAll('[data-rut]').forEach(b=>b.onclick=()=>openCase(b.dataset.rut));
 }
 list();
}
function manualNotice(tracking){
 if(!admin()||!tracking.active||tracking.closed||!tracking.assignee)return '';
 const subject=deadline(tracking)==='Vencido'?'Seguimiento académico vencido':'Aviso de seguimiento académico';
 const message='Tiene un caso asignado en Seguimiento Académico. Revise sus casos y plazos en el panel institucional:\n\nhttps://csd-ipg.github.io/Simulador/escuela/seguimiento/';
 const url=new URL('https://mail.google.com/mail/');
 url.search=new URLSearchParams({authuser:'escuela.gestion@ipg.cl',view:'cm',fs:'1',to:tracking.assignee,su:subject,body:message});
 return '<p><a href="'+html(url.href)+'" target="_blank" rel="noopener noreferrer">Redactar aviso en Gmail</a><br><small>Para asignaciones urgentes o vencimientos. Revise el remitente antes de enviar.</small></p>';
}
function solicitudesIPG(items=[]){
 const fields=[['Jefatura de Carrera','jefatura'],['Registro Académico','registro'],['Jefatura Administrativa','administracion'],['Finanzas','finanzas']];
 return '<h3>Solicitudes y derivaciones IPG</h3>'+(items.length?items.map(s=>'<article class="history"><b>'+html(s.tipo)+'</b> · '+html(s.fecha||new Date(s.enviada_en).toLocaleDateString('es-CL',{timeZone:'America/Santiago'}))+fields.filter(([,k])=>s[k]).map(([label,k])=>'<p><strong>'+label+'</strong> · '+html(s[k])+'</p>').join('')+'</article>').join(''):'<p class="muted">No hay solicitudes sincronizadas para este estudiante.</p>');
}
function openCase(rut){
 const c=allCases().find(v=>v.rut===rut),t=model.tracking[rut];if(!c||!t)return;
 caseRut=rut;pendingId=crypto.randomUUID();const dialog=$('caseDialog');cleanDialog(dialog);
 const assignments=admin()&&!t.closed?'<form id="assign"><label>Responsable asignado<select id="assignee">'+options([['','Sin asignar'],...unique([...(user.members||[]).filter(m=>m.active&&m.role==='Consejería').map(m=>m.email),t.assignee])],t.assignee||'')+'</select></label><button class="secondary">Guardar asignación</button></form>':'';
 const hist=t.events.map(ev=>'<article class="history"><b>'+html(ev.outcome)+'</b> · '+html(ev.channel)+'<br><small>'+html(new Date(ev.created_at).toLocaleString('es-CL',{timeZone:'America/Santiago'}))+' · '+html(ev.author)+'</small><p>'+html(ev.note)+'</p>'+[['Recurso CSD',ev.csd],['Derivación',ev.referral],['Próximo seguimiento',ev.next_date],['Fecha sugerida',ev.suggested_date],['Motivo de cambio',ev.reschedule_reason],['Evidencia CSD',ev.evidence]].filter(x=>x[1]).map(([k,v])=>'<p>'+k+' · '+html(v)+'</p>').join('')+'</article>').join('');
 $('caseDetail').innerHTML='<h3>'+html(c.name)+'</h3><p>'+html(c.rut)+' · '+html(c.career)+'</p>'+(t.active?'<div class="notice">'+html(suggestedAction(c))+' <a href="../../" target="_blank" rel="noopener">Abrir CSD</a></div>'+table(['Asignatura','Sección','Nota final','Situación'],c.subjects.map(r=>[html(r.subject),html(r.section),r.grade.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1}),html(gradeLabels[gradeStatus(r.grade)])+(r.review?'<br><small>Revisar cierre con Registro Curricular</small>':'')])):'<p class="notice">Esta ficha quedó archivada al actualizar el cierre. Su historial está disponible para consulta.</p>')+assignments+manualNotice(t)+
 '<div class="notice"><strong>Estado: '+(t.closed?'CERRADO':'ABIERTO')+'</strong>'+(t.closed?'<p>Cierre registrado: '+html(t.closed_at?new Date(t.closed_at).toLocaleString('es-CL',{timeZone:'America/Santiago'}):'Sin fecha')+' · Responsable del cierre: '+html(t.closed_by||'No registrado')+'</p>':'<p>La ficha permanecerá activa hasta confirmar el cierre.</p>')+'</div><p><button type="button" class="secondary" id="downloadCase">Descargar ficha de gestión (Word)</button></p>'+
 '<p><small>Responsable asignado: '+html(staffName(t.assignee))+' · Supervisor de carrera: '+html(staffName(t.supervisor))+' · Supervisión general: Dirección de Escuela'+'. La identificación de supervisión no equivale a una firma o aprobación.</small></p>'+
 (!t.closed?'<div class="notice"><strong>Próximo seguimiento: '+html(t.due||'Sin programar')+' · '+html(deadline(t))+'</strong><p>Fecha sugerida: '+html(t.suggested_due||'—')+' · Evidencia CSD: '+html(t.evidence||'No solicitada')+'</p><form id="reschedule"><label>Nueva fecha<input type="date" name="next_date" required value="'+html(t.due||followDate())+'"></label><label>Motivo de reprogramación<input name="reason" required maxlength="1000"></label><button class="secondary">Guardar reprogramación</button></form></div>':'')+((t.schedule_history||[]).length?'<h3>Historial de reprogramaciones</h3>'+t.schedule_history.map(h=>'<p>'+html(h.previous||'—')+' → '+html(h.next)+' · '+html(h.reason)+' · '+html(h.author)+' · '+html(h.at)+'</p>').join(''):'')+
 solicitudesIPG(t.solicitudes_ipg)+
 '<h3 style="margin-top:20px">Historial de intervenciones</h3>'+(hist||'<p class="muted">Aún no se registran intervenciones.</p>')+
 (t.closed?'':'<form id="eventForm"><h3>Registrar intervención</h3><div class="fields"><label>Canal<select name="channel">'+options(['Correo institucional','Llamada','Reunión','Aula virtual','Otro'])+'</select></label><label>Resultado<select name="outcome">'+options(['Intento sin respuesta','Contacto efectivo','Derivado','Cerrado'])+'</select></label></div><label>Gestión realizada y acuerdos<textarea name="note" required maxlength="4000"></textarea></label><label>Recurso del CSD recomendado<input name="csd" maxlength="300"></label><div class="fields"><label>Área de derivación<input name="referral" maxlength="300"></label><label>Próximo seguimiento<input name="next_date" type="date"></label></div><p id="suggestedDate" class="muted"></p><label>Motivo si modifica la fecha sugerida<input name="reason" maxlength="1000"></label><label>Evidencia CSD<select name="evidence">'+options(['No solicitada','Pendiente','Recibida','Revisada','No recibida'],t.evidence||'No solicitada')+'</select></label><p class="muted">Al recomendar un recurso CSD, solicite al estudiante enviar evidencia de realización al responsable por canal institucional en cuatro semanas. Registre su recepción y revisión en una intervención posterior.</p><label class="notice"><input type="checkbox" name="cerrar" value="true" id="closeCase"> Confirmo que las gestiones se encuentran concluidas y solicito cerrar este caso. Una vez cerrado, quedará sólo para consulta.</label><button>Guardar intervención</button></form>');
 if(!dialog.open)dialog.showModal();
 const refresh=async()=>{const p=period;const raw=await api('leer',{periodo:p});if(p!==period||!user)return;model={...model,...raw,analysis:analyze(raw.rows)};drawCases();openCase(rut)};
 $('downloadCase').onclick=e=>busy(e.currentTarget,async()=>{const {generateCaseSheet}=await import('./office.js');const {blob,filename}=await generateCaseSheet({period,caseData:c,tracking:t});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),45000);status('Ficha individual descargada.')});
 if(t.closed)return;
 $('reschedule').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{await api('reprogramar',{...Object.fromEntries(new FormData(e.target)),periodo:period,rut,prev:t.due||''});await refresh();status('Fecha reprogramada.')})};
 if(admin())$('assign').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{await api('asignar',{periodo:period,rut,email:$('assignee').value,prev:t.assignee});await refresh();status('Asignación guardada.')})};
 const f=$('eventForm');const suggest=()=>{const closed=f.elements.outcome.value==='Cerrado',csd=!!f.elements.csd.value.trim();f.elements.referral.required=f.elements.outcome.value==='Derivado';f.elements.cerrar.required=closed;f.elements.next_date.disabled=closed;f.elements.next_date.value=closed?'':followDate(csd);$('suggestedDate').textContent=closed?'Sin próximo seguimiento':'Fecha automática: '+f.elements.next_date.value+(csd?' (4 semanas CSD; solicitar evidencia)':' (5 días hábiles)');if(csd)f.elements.evidence.value='Pendiente';};f.elements.outcome.onchange=suggest;f.elements.csd.onchange=suggest;suggest();
 f.onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{const values=Object.fromEntries(new FormData(f));if(values.cerrar==='true'&&values.outcome!=='Cerrado')throw Error('Seleccione el resultado Cerrado para cerrar la ficha.');await api('intervenir',{...values,periodo:period,rut,id:pendingId});await refresh();status('Intervención guardada.')})};
}
function drawTeam(){
 if(!admin())return;
 const members=user.members||[];
 const rows=members.map((m,i)=>{
  const permission=m.active?'Habilitado':'Suspendido';
  const linked=m.linked?'Cuenta vinculada':m.expires&&Date.parse(m.expires)>Date.now()?'Enlace vigente':'Pendiente de activación';
  const permit='<button class="secondary" data-member="'+i+'">'+(m.active?'Suspender acceso':'Habilitar acceso')+'</button>';
  const invite=m.active&&!m.linked?'<button data-invite="'+i+'">'+(linked==='Enlace vigente'?'Renovar enlace':'Generar enlace de activación')+'</button>':'';
  return [html(m.email),html(m.role),permission,linked,'<div class="actions">'+invite+permit+'</div>'];
 });
 $('content').innerHTML='<section class="card"><h2>Equipo de seguimiento</h2><p>Los integrantes con cuenta vinculada ingresan con su clave personal. Para quienes están pendientes, genere un enlace y compártalo por un canal individual. Puede asignar fichas antes de la activación.</p><form id="memberForm"><div class="fields"><label>Correo institucional<input name="email" type="email" required></label><label>Perfil<select name="role">'+options(['Jefatura','Consejería'])+'</select></label></div><button>Habilitar integrante</button></form></section><section class="card"><h2>Integrantes</h2>'+(members.length?table(['Correo','Perfil','Acceso','Cuenta','Acciones'],rows):'<p>Aún no hay integrantes habilitados.</p>')+'</section>';
 async function save(values){await api('equipo',values);user=await api('inicio');if(!admin())return;drawTeam();status('Acceso de equipo actualizado.')}
 const setup=document.createElement('button');
 setup.className='secondary';setup.textContent='Generar clave de sincronización IPG';
 setup.onclick=()=>busy(setup,async()=>{
  if(!confirm('Generar una clave desactiva la anterior. ¿Continuar?'))return;
  const actor=token;
  const key=await jsonRequest('/rest/v1/rpc/configurar_acceso_solicitudes_ipg',{},actor);
  if(actor!==token||!admin())return;
  $('inviteLink').value=key;
  $('inviteMessage').textContent='Clave de sincronización IPG. Cópiela en las propiedades del proyecto privado de Apps Script.';
  $('copied').textContent='';$('inviteDialog').showModal();$('inviteLink').select();
 });
 $('content').prepend(setup);
 $('memberForm').onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));busy(e.submitter,()=>save({...v,active:true}))};
 $('content').querySelectorAll('[data-member]').forEach(btn=>btn.onclick=()=>{const m=members[+btn.dataset.member];busy(btn,()=>save({email:m.email,role:m.role,active:!m.active}))});
 $('content').querySelectorAll('[data-invite]').forEach(btn=>btn.onclick=()=>busy(btn,async()=>{
  const m=members[+btn.dataset.invite];
  const result=await api('activacion',{email:m.email});
  if(!admin())return;
  const link=new URL('./',location.href);link.hash=new URLSearchParams({activar:result.codigo}).toString();
  $('inviteLink').value=link.href;
  $('inviteMessage').textContent='Comparta este enlace únicamente con '+m.email+'. Vence el '+new Date(result.vence).toLocaleString('es-CL',{timeZone:'America/Santiago'})+' (hora de Chile).';
  $('copied').textContent='';$('inviteDialog').showModal();$('inviteLink').select();
  user=await api('inicio');if(admin())drawTeam();
 }));
}
$('inviteDialog').addEventListener('close',()=>{$('inviteLink').value='';$('inviteMessage').textContent='';});
$('copyInvite').onclick=async()=>{try{await navigator.clipboard.writeText($('inviteLink').value);$('copied').textContent='Enlace copiado.'}catch{$('inviteLink').select();$('copied').textContent='El enlace está seleccionado. Cópielo con el teclado.'}};
function drawExports(){
 if(!admin())return;
 const files=[['informe','Word','Informe académico','Análisis del cierre, indicadores de rendimiento y focos de seguimiento.'],['contactos','Excel','Reporte de contacto','Fichas de estudiantes, responsables e intervenciones registradas.'],['presentacion','PowerPoint','Presentación de resultados','Diapositivas institucionales para el Consejo de Escuela.'],['tablero','Excel','Tablero de información','Indicadores, desgloses y base del ciclo para su análisis.']];
 $('content').innerHTML='<section class="card"><h2>Reportes del cierre</h2><p>'+html(periodName(period))+' · Versión '+fmt(model.version)+' · '+html(model.filename)+'</p><p class="muted">Las descargas consideran el ciclo completo. El reporte de contacto incluye las gestiones guardadas hasta el momento de la descarga.</p></section><div class="files">'+files.map(([key,type,title,desc])=>'<article class="card"><span class="filetype">'+type+'</span><div><h3>'+title+'</h3><p>'+desc+'</p></div><button data-file="'+key+'">Descargar '+type+'</button></article>').join('')+'</div>';
 $('content').querySelectorAll('[data-file]').forEach(btn=>btn.onclick=()=>busy(btn,async()=>{const p=period,base=model,actor=token;const raw=await api('reporte',{periodo:p});if(!admin()||actor!==token||period!==p)throw Error('Cambió el cierre seleccionado. Vuelva a descargar.');const current={...base,...raw,analysis:analyze(raw.rows)};const {generateOffice}=await import('./office.js');const {blob,filename}=await generateOffice(btn.dataset.file,current);if(!admin()||actor!==token||period!==p)return;const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),45000);status('Descarga preparada para '+periodName(p)+'.')}));
}
$('openImport').onclick=()=>{if(!admin())return;preview=null;const d=$('importDialog');cleanDialog(d);$('loadForm').reset();$('year').value=period?+period.slice(0,4):new Date().getFullYear();$('cycle').value=period?Math.min(10,+period.slice(5)+1):'';$('preview').replaceChildren();d.showModal()};
$('loadForm').oninput=()=>{preview=null;$('preview').replaceChildren();cleanDialog($('importDialog'))};
$('loadForm').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{
 cleanDialog($('importDialog'));preview=null;$('preview').textContent='Validando inscripciones y clasificación…';
 const input=$('file').files[0],year=+$('year').value,cycle=+$('cycle').value,p=year+'-'+String(cycle).padStart(2,'0');
 if(input.size>30*1024*1024)throw Error('El archivo supera el límite de 30 MB.');
 const data=await parseWorkbook(await input.arrayBuffer());if(input!==$('file').files[0]||year!==+$('year').value||cycle!==+$('cycle').value){$('preview').replaceChildren();return}
 if((data.year&&data.year!==year)||(data.cycle&&data.cycle!==cycle))data.errors.push('El período seleccionado no coincide con el de la planilla ('+(data.year||'año sin indicar')+', ciclo '+(data.cycle||'sin indicar')+').');
 const a=analyze(data.rows),fresh=await api('inicio'),prior=fresh.periods.find(x=>x.period===p);
 const issues=[...data.errors,...data.warnings];const counts=fmt(a.summary.total)+' inscripciones · '+fmt(a.summary.students)+' estudiantes · '+fmt(a.cases.length)+' fichas de contacto · '+fmt(a.summary.review)+' cierres por revisar';
 $('preview').innerHTML='<h3 style="margin-top:16px">'+html(periodName(p))+'</h3><p>'+counts+'</p><p class="small">Hoja '+html(data.sheet)+' · '+fmt(data.excluded)+' filas fuera del alcance · '+fmt(data.duplicates)+' duplicados</p>'+(issues.length?'<ul class="issue">'+issues.map(i=>'<li>'+html(i)+'</li>').join('')+'</ul>':'')+(data.errors.length?'<p class="alert error">Corrija los errores indicados y valide nuevamente.</p>':(prior?'<p class="notice">Este período ya tiene un cierre. Al confirmar se actualizarán los resultados. Se conservarán las asignaciones y las intervenciones.</p>':'')+'<button id="confirmImport">'+(prior?'Confirmar actualización':'Confirmar carga')+'</button>');
 if(data.errors.length)return;preview={p,rows:data.rows,filename:input.name,expected:prior?.version||0};
 $('confirmImport').onclick=ev=>busy(ev.currentTarget,async()=>{if(!preview)return;const v=preview;await api('importar',{periodo:v.p,expected:v.expected,filename:v.filename,rows:v.rows});preview=null;$('importDialog').close();tab='dashboard';await start(v.p);status('Cierre guardado. Los cuatro documentos están disponibles en Reportes.')});
 })};
if(token&&!activationCode)start().catch(e=>{showLogin();fail(e)});else showLogin();
