/* Native Office Open XML exports for the closure selected in the academic dashboard. */
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const X = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const school = 'Escuela de Gestión, Negocios y Marítima';
const formats = {
  informe: ['Informe_Asignaturas_Criticas','docx','wordprocessingml.document'],
  contactos: ['Reporte_Contacto_Estudiantes','xlsx','spreadsheetml.sheet'],
  tablero: ['Tablero_Asignaturas_Criticas','xlsx','spreadsheetml.sheet'],
  presentacion: ['Presentacion_Rendimiento_Academico','pptx','presentationml.presentation']
};
const xml = v => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const integer = n => Number.isFinite(n) ? new Intl.NumberFormat('es-CL').format(n) : '—';
const percent = n => Number.isFinite(n) ? new Intl.NumberFormat('es-CL',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(n) : '—';
const decimal = n => Number.isFinite(n) ? new Intl.NumberFormat('es-CL',{maximumFractionDigits:2}).format(n) : '—';
const period = m => 'Ciclo '+m.cycle+' de '+m.year;
const localeDate = v => v ? (new Date(v).toString()==='Invalid Date' ? String(v) : new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(v))) : '';
const affirmative = v => v===true?'Sí':v===false?'No':String(v??'');
function guide(item){
  const q=item.absent ? 'qué dificultó su participación' : item.notTaken ? 'qué dificultó rendir las evaluaciones' : 'qué contenidos le resultaron difíciles';
  return 'Contactar al estudiante y preguntar '+q+'. Recomendar recursos del Centro de Simulación Digital (CSD) para reforzar contenidos. Si plantea un problema, derivarlo al área correspondiente.'+(item.review?' Verificar el cierre con Registro Curricular.':'');
}
function relationships(entries){return XML+'<Relationships xmlns="'+RELS+'">'+entries.map(([id,type,target])=>'<Relationship Id="'+id+'" Type="'+OFFICE+'/'+type+'" Target="'+xml(target)+'"/>').join('')+'</Relationships>';}
function contentTypes(parts){return XML+'<Types xmlns="'+TYPES+'"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+parts.map(([name,ctype])=>'<Override PartName="/'+name+'" ContentType="application/vnd.openxmlformats-officedocument.'+ctype+'+xml"/>').join('')+'</Types>';}
function trackingFor(m,rut){const value=m.tracking?.[rut]||{};return {assignee:value.assignee||'',events:[...(value.events||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))};}
function context(m){
  const a=m.analysis,s=a.summary,previous=m.previous?.analysis?.summary;
  const critical=a.subjects.filter(i=>/rojo|amarillo/i.test(i.status)).sort((x,y)=>(x.approval??1)-(y.approval??1)||y.failed-x.failed);
  const missing=a.subjects.filter(i=>i.notTaken>0).sort((x,y)=>y.notTaken-x.notTaken||x.coverage-y.coverage);
  const histories=a.cases.map(c=>trackingFor(m,c.rut).events);
  const outcomeCounts={};for(const events of histories){const outcome=events[0]?.outcome||'Pendiente';outcomeCounts[outcome]=(outcomeCounts[outcome]||0)+1;}
  const managed=histories.filter(e=>e.length>0).length,reached=histories.filter(e=>e.some(v=>v.outcome==='Contacto efectivo')).length;
  return {a,s,previous,critical,missing,managed,reached,outcomeCounts};
}
function slideFields(m){
  const {s,previous:p,critical,missing,managed,reached}=context(m);
  const f={period:period(m),total:integer(s.total),approval:percent(s.approval),coverage:percent(s.coverage),students:integer(s.students),absent:integer(s.absent),notTaken:integer(s.notTaken),failed:integer(s.failed),passed:integer(s.passed),atRisk:integer(s.atRisk),highRisk:integer(s.highRisk),managed:integer(managed),reached:integer(reached),
    apDetail:integer(s.passed)+' aprobaciones de '+integer(s.evaluated)+' inscripciones evaluadas.',covDetail:integer(s.evaluated)+' evaluadas de '+integer(s.total)+' inscripciones.',studentDetail:'Personas únicas en las inscripciones del ciclo.',reviews:integer(s.review)+' finales 0,0 con parciales positivos requieren contraste con el acta.',
    critNote:critical.length?integer(critical.length)+' combinaciones con alerta roja o amarilla en el cierre.':'El cierre no presenta combinaciones con alerta roja o amarilla.',
    missNote:missing.length?integer(s.notTaken)+' inscripciones con nota 1,0 en el cierre.':'No se registran inscripciones con nota 1,0.',
    prevPeriod:p?period(m.previous):'Cierre anterior',prevTotal:integer(p?.total),prevApproval:percent(p?.approval),prevCoverage:percent(p?.coverage),prevAtRisk:integer(p?.atRisk),compareNote:p?'Las cohortes y asignaturas impartidas pueden variar entre cierres.':'Todavía no hay un cierre anterior disponible para comparar.'};
  for(let i=0;i<3;i++){
    const c=critical[i],n=missing[i];
    for(const [key,val] of Object.entries({s:c?.subject,c:c?.career,a:c?.status,v:c?percent(c.approval):''}))f['crit'+i+key]=val||'—';
    for(const [key,val] of Object.entries({s:n?.subject,c:n?.career,n:n?integer(n.notTaken):'',v:n?percent(n.coverage):''}))f['miss'+i+key]=val||'—';
  }
  return f;
}
async function presentation(m){
  const response=await fetch(new URL('./portada-ipg.pptx',import.meta.url));if(!response.ok)throw Error('No se pudo abrir el formato institucional de PowerPoint.');
  const zip=await globalThis.JSZip.loadAsync(await response.arrayBuffer()),fields=slideFields(m);
  for(const [path,part] of Object.entries(zip.files)){
    if(!/^ppt\/slides\/slide\d+\.xml$/.test(path))continue;
    const source=await part.async('string');
    zip.file(path,source.replace(/\{\{(\w+)\}\}/g,(_,key)=>{if(!(key in fields))throw Error('Falta contenido para la presentación.');return xml(fields[key]);}));
  }
  return zip;
}
function wordReport(m){
  const z=new globalThis.JSZip(),{a,s,previous:p,critical,missing,managed,reached}=context(m);
  const paragraph=(str,opt={})=>'<w:p><w:pPr>'+(opt.page?'<w:pageBreakBefore/>':'')+(opt.heading?'<w:keepNext/>':'')+'<w:spacing w:after="'+(opt.heading?85:105)+'"/></w:pPr><w:r><w:rPr>'+(opt.heading?'<w:b/>':'')+'<w:color w:val="'+(opt.color||'26394D')+'"/><w:sz w:val="'+(opt.size||22)+'"/></w:rPr><w:t xml:space="preserve">'+xml(str)+'</w:t></w:r></w:p>';
  const heading=(str,page=false)=>paragraph(str,{heading:true,size:32,color:'174B78',page});
  function table(head,body,widths){
    return '<w:tbl><w:tblPr><w:tblW w:type="pct" w:w="5000"/><w:tblLayout w:type="fixed"/><w:tblCellMar>'+['top','bottom','left','right'].map(k=>'<w:'+k+' w:w="72" w:type="dxa"/>').join('')+'</w:tblCellMar></w:tblPr><w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>'+[head,...body].map((row,i)=>'<w:tr><w:trPr><w:cantSplit/>'+(i?'':'<w:tblHeader/>')+'</w:trPr>'+row.map((v,j)=>'<w:tc><w:tcPr><w:tcW w:w="'+widths[j]+'" w:type="dxa"/><w:shd w:fill="'+(i?(i%2?'EEF4FA':'F9FBFD'):'18578A')+'"/></w:tcPr><w:p><w:pPr><w:spacing w:after="35"/></w:pPr><w:r><w:rPr>'+(i?'':'<w:b/>')+'<w:color w:val="'+(i?'19374F':'FFFFFF')+'"/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">'+xml(v)+'</w:t></w:r></w:p></w:tc>').join('')+'</w:tr>').join('')+'</w:tbl>';
  }
  const b=[];
  b.push(paragraph(school,{color:'175E9D',size:22,heading:true}),paragraph('Rendimiento académico y asignaturas críticas',{heading:true,size:46,color:'122F4D'}),paragraph(period(m)+'  ·  Cierre de asignaturas',{size:27,color:'286D97'}),paragraph('De '+integer(s.total)+' inscripciones, '+integer(s.evaluated)+' tuvieron una nota final efectivamente obtenida. Aprobaron '+integer(s.passed)+' y reprobaron '+integer(s.failed)+' entre quienes rindieron. La cobertura de rendición alcanzó '+percent(s.coverage)+'.'),heading('Distribución de las inscripciones'),
    table(['Resultado de cierre','Inscripciones','% de matrícula'],[['Sin participación · 0,0',s.absent],['No rindió · 1,0',s.notTaken],['Rindió y reprobó · 1,1–3,9',s.failed],['Rindió y aprobó · 4,0–7,0',s.passed]].map(([k,v])=>[k,integer(v),percent(s.total?v/s.total:null)]),[4700,1850,2250]),
    paragraph('El cierre comprende '+integer(s.students)+' estudiantes. La nota media entre quienes rindieron fue '+decimal(s.mean)+'.'),heading('Comparación entre cierres'),
    table(['Indicador',p?period(m.previous):'Cierre anterior',period(m)],[['Inscripciones',integer(p?.total),integer(s.total)],['Aprobación entre evaluados',percent(p?.approval),percent(s.approval)],['Cobertura de rendición',percent(p?.coverage),percent(s.coverage)],['Estudiantes a contactar',integer(p?.atRisk),integer(s.atRisk)]],[4400,2200,2200]),
    paragraph(p?'Las carreras, cohortes y asignaturas impartidas pueden variar entre los cierres comparados.':'Todavía no hay un cierre anterior disponible para comparación.'));
  b.push(heading('Asignaturas críticas y participación',true),paragraph('El semáforo compara la aprobación entre evaluados con la meta de la línea curricular. La cobertura muestra qué proporción de inscritos rindió. Ambas medidas orientan decisiones distintas.'));
  if(critical.length)b.push(heading('Alertas por aprobación'),table(['Asignatura','Carrera','Semáforo','Rindieron','Aprobación'],critical.slice(0,5).map(v=>[v.subject,v.career,v.status,integer(v.evaluated),percent(v.approval)]),[2380,2910,1250,1030,1230]));else b.push(paragraph('El cierre no presenta combinaciones con alerta roja o amarilla.'));
  if(missing.length)b.push(heading('Mayor volumen de evaluaciones no rendidas'),table(['Asignatura','Carrera','No rindieron','Cobertura'],missing.slice(0,5).map(v=>[v.subject,v.career,integer(v.notTaken),percent(v.coverage)]),[2800,3350,1350,1300]));else b.push(paragraph('El cierre no registra notas finales 1,0.'));
  b.push(heading('Nivel y línea curricular',true));
  if(a.levels.length)b.push(table(['Nivel','Inscripciones','Rindieron','Aprobación','Cobertura'],a.levels.map(v=>[v.level,integer(v.total),integer(v.evaluated),percent(v.approval),percent(v.coverage)]),[1850,1800,1650,1750,1750]));
  if(a.lines.length)b.push(heading('Resultados por línea'),table(['Línea curricular','Inscripciones','Aprobación','Cobertura'],a.lines.map(v=>[v.line||'Sin área',integer(v.total),percent(v.approval),percent(v.coverage)]),[3550,1700,1700,1850]));
  b.push(heading('Seguimiento de estudiantes',true),paragraph('Se identifican '+integer(s.atRisk)+' estudiantes con asignaturas sin aprobar. De ellos, '+integer(s.highRisk)+' presentan tres o más y corresponden al nivel de riesgo alto.'),table(['Riesgo de trayectoria','Estudiantes'],['Alto','Medio','Bajo'].map(k=>[k,integer(a.cases.filter(c=>String(c.risk).toLowerCase()===k.toLowerCase()).length)]),[6400,2400]),
    heading('Gestiones registradas'),paragraph(integer(managed)+' estudiantes cuentan con al menos una intervención y '+integer(reached)+' registran al menos una intervención marcada como contacto efectivo. Los intentos sin respuesta quedan en la ficha para el siguiente seguimiento.'),
    paragraph('Contactar a cada estudiante, invitarle a explicar sus dificultades y recomendar recursos del Centro de Simulación Digital para reforzar contenidos. Derivar la situación según su naturaleza y registrar el próximo seguimiento cuando corresponda.'),
    heading('Revisión de cierres'),paragraph(integer(s.review)+' inscripciones con final 0,0 presentan parciales positivos. Corresponde contrastar estos registros con el acta y mantener su clasificación por nota final hasta que exista un cierre corregido.'),
    heading('Criterios de lectura'),paragraph('La aprobación se calcula sobre quienes rindieron (nota final desde 1,1). La cobertura de rendición divide este grupo por todas las inscripciones. Los estudiantes se cuentan una vez por ciclo y pueden presentar dificultades en varias asignaturas.'),
    paragraph('Verde indica cumplimiento de la meta de la línea. Amarillo indica una brecha de hasta 10 puntos porcentuales. Rojo corresponde a una brecha superior a 10 puntos. Se prioriza el rojo con déficit superior a 15 puntos y al menos 30 inscritos distintos o dos secciones con ese déficit.'),
    paragraph('Fuente: '+(m.filename||'Consolidado del cierre')+' · '+period(m)+' · Versión '+(m.version??1)+'.',{size:18,color:'526A7D'}));
  z.file('[Content_Types].xml',contentTypes([['word/document.xml','wordprocessingml.document.main'],['word/footer1.xml','wordprocessingml.footer']]));
  z.file('_rels/.rels',relationships([['rId1','officeDocument','word/document.xml']]));z.file('word/_rels/document.xml.rels',relationships([['rId1','footer','footer1.xml']]));
  z.file('word/footer1.xml',XML+'<w:ftr xmlns:w="'+W+'"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>IPG  ·  '+xml(period(m))+'  ·  </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>');
  z.file('word/document.xml',XML+'<w:document xmlns:w="'+W+'" xmlns:r="'+OFFICE+'"><w:body>'+b.join('')+'<w:sectPr><w:footerReference w:type="default" r:id="rId1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="960" w:bottom="960" w:left="1134" w:right="1134" w:header="400" w:footer="400"/></w:sectPr></w:body></w:document>');
  return z;
}
const colName = n => n<26?String.fromCharCode(65+n):colName(Math.floor(n/26)-1)+String.fromCharCode(65+n%26);
const typ = (v,style) => ({v,style});
const pctCell = v=>typ(v,4), decCell=v=>typ(v,5);
const tab=(name,title,heads,rows,widths,options={})=>({name,title,heads,rows,widths,...options});
function dashboardSheets(m){
  const {a,s,previous:p,managed,reached}=context(m);
  const statsHead=['Inscripciones','Rindieron','Aprobaron','Rindieron y reprobaron','No rindieron','Sin participación','Aprobación entre evaluados','Cobertura de rendición','Aprobación sobre matrícula','Nota media entre evaluados','Cierres por revisar'];
  const stats=v=>[v.total,v.evaluated,v.passed,v.failed,v.notTaken,v.absent,pctCell(v.approval),pctCell(v.coverage),pctCell(v.total?v.passed/v.total:null),decCell(v.mean),v.review];
  const dims=(name,groups,keys)=>tab(name,'Resultados por '+name.toLowerCase(),[...keys.map(k=>k[0]),...statsHead],groups.map(v=>[...keys.map(k=>v[k[1]]),...stats(v)]),[...keys.map(k=>k[2]),...statsHead.map(()=>20)]);
  const prevHeading=p?period(m.previous):'Cierre anterior';
  const title=tab('Tablero','Indicadores de la Escuela',['Indicador',period(m),prevHeading],[
    ['Inscripciones',s.total,p?.total],['Estudiantes únicos',s.students,p?.students],['Rindieron',s.evaluated,p?.evaluated],['Aprobación entre evaluados',pctCell(s.approval),pctCell(p?.approval)],['Cobertura de rendición',pctCell(s.coverage),pctCell(p?.coverage)],['Aprobación sobre matrícula',pctCell(s.total?s.passed/s.total:null),pctCell(p?.total?p.passed/p.total:null)],['Estudiantes a contactar',s.atRisk,p?.atRisk],['Riesgo alto',s.highRisk,p?.highRisk],['Finales 0,0 con parciales positivos',s.review,p?.review],['Estudiantes con intervenciones',managed,null],['Con algún contacto efectivo',reached,null]
  ],[38,24,24],{chart:true});
  const counts=new Map();a.subjects.forEach(v=>counts.set(v.status,(counts.get(v.status)||0)+1));
  return [title,tab('Participación','Distribución del cierre',['Situación','Inscripciones','% sobre matrícula'],[['Sin participación',s.absent],['No rindieron',s.notTaken],['Rindieron y reprobaron',s.failed],['Rindieron y aprobaron',s.passed]].map(([k,v])=>[k,v,pctCell(s.total?v/s.total:null)]),[32,20,22]),
    tab('Semáforo','Semáforo de asignaturas',['Clasificación','Combinaciones carrera–asignatura'],Array.from(counts),[32,34]),
    tab('Asignaturas','Resultados por carrera y asignatura',['Cód. carrera','Carrera del estudiante','Cód. asignatura','Asignatura','Semáforo','Línea curricular','Meta de línea','Brecha en puntos porcentuales',...statsHead],a.subjects.map(v=>[v.careerCode,v.career,v.subjectCode,v.subject,v.status,v.line,pctCell(v.target),decCell(v.target!=null&&v.approval!=null?100*(v.approval-v.target):null),...stats(v)]),[18,48,25,52,23,30,15,26,...statsHead.map(()=>20)]),
    dims('Carreras',a.careers,[['Código carrera','careerCode',20],['Carrera','career',50]]),dims('Niveles',a.levels,[['Nivel','level',18]]),dims('Líneas',a.lines,[['Línea curricular','line',32]]),dims('Cohortes',a.cohorts,[['Cohorte','cohort',18]]),dims('Secciones',a.sections,[['Carrera','career',46],['Asignatura','subject',46],['Sección','section',17]]),dims('Docentes',a.teachers,[['Docente','teacher',42]]),
    tab('Estudiantes en riesgo','Riesgo de trayectoria',['Estudiante','RUT','Carrera','Riesgo','Asignaturas sin aprobar','Sin participación','No rindió','Rindió y reprobó','Cierres por revisar'],a.cases.map(c=>[c.name,c.rut,c.career,c.risk,c.affected,c.absent,c.notTaken,c.failed,c.review]),[36,20,48,15,20,20,20,20,20]),
    tab('Base Escuela','Inscripciones del cierre',['RUT','Estudiante','Código alumno','Código carrera','Carrera','Código asignatura','Asignatura','Sección','Nivel','Línea curricular','Cohorte','Docente','Nota final','Situación','Revisar cierre'],m.rows.map(r=>[r.rut,r.name,r.studentCode,r.careerCode,r.career,r.subjectCode,r.subject,r.section,r.level,r.line,r.cohort,r.teacher,decCell(r.grade),gradeLabel(r.grade),r.review?'Sí':'No']),[19,36,19,20,44,24,45,16,13,26,16,38,16,27,16])];
}
function gradeLabel(g){return g===0?'Sin participación':g===1?'No rindió':g<4?'Rindió y reprobó':'Rindió y aprobó';}
function contactSheets(m){
  const {a,s,managed,reached,outcomeCounts}=context(m);const cases=a.cases;
  const byRut=new Map(cases.map(c=>[c.rut,c]));
  const shared=['Alto','Medio','Bajo'].map(r=>[r,cases.filter(c=>c.risk===r).length]);
  const contacts=cases.map(c=>{
    const {assignee,events}=trackingFor(m,c.rut),last=events[0]||{};
    return [c.risk,c.name,c.rut,c.career,c.affected,c.absent,c.notTaken,c.failed,c.review,guide(c),assignee,last.outcome||'Pendiente',localeDate(last.created_at),last.channel,last.note,last.next_date||'',last.referral,affirmative(last.csd),events.length,c.subjects.map(v=>v.subject+' ('+decimal(v.grade)+')').join(' · ')];
  });
  const histories=Object.entries(m.tracking||{}).flatMap(([rut,t])=>(t.events||[]).map(e=>[rut,byRut.get(rut)?.name||t.name||m.rows.find(r=>r.rut===rut)?.name||'',byRut.has(rut)?'Sí':'No',e.created_at,e.author,e.channel,e.outcome,e.note,affirmative(e.csd),e.referral,e.next_date])).sort((a,b)=>String(b[3]).localeCompare(String(a[3]))).map(row=>row.map((v,i)=>i===3?localeDate(v):v));
  return [tab('Resumen','Seguimiento por jefatura de carrera',['Indicador','Cantidad'],[['Estudiantes a contactar',s.atRisk],['Inscripciones que motivan contacto',s.absent+s.notTaken+s.failed],['Estudiantes con intervenciones',managed],['Con algún contacto efectivo',reached],['Cierres por revisar',s.review],...shared.map(([k,v])=>['Riesgo '+k.toLowerCase(),v]),...Object.entries(outcomeCounts).map(([k,v])=>['Estado actual · '+k,v])],[50,22]),
    tab('Contactos','Contactos por estudiante',['Riesgo','Estudiante','RUT estudiante','Carrera del estudiante','Asignaturas sin aprobar','Sin participación (0,0)','No rindió (1,0)','Rindió y reprobó (1,1–3,9)','Cierres por revisar','Gestión sugerida','Responsable asignado','Estado de gestión','Fecha última gestión','Canal utilizado','Resultado o acuerdo','Próximo seguimiento','Derivación','Recurso CSD indicado','Intervenciones','Asignaturas y notas que motivan contacto'],contacts,[15,35,19,50,17,17,16,17,15,60,35,23,22,20,53,20,35,30,15,65],{tall:true}),
    tab('Intervenciones','Historial de intervenciones',['RUT','Estudiante','Caso vigente en este cierre','Fecha y hora (Chile)','Registrado por','Canal','Resultado de gestión','Intervención y acuerdo','Recurso CSD indicado','Derivación','Próximo seguimiento'],histories,[19,35,20,24,36,22,24,65,30,35,22],{tall:true}),
    tab('Detalle original','Inscripciones de estudiantes que requieren contacto',['Motiva contacto','Riesgo','Estudiante','RUT','Carrera','Asignatura','Sección','Docente','Nota final','Clasificación','Revisar cierre'],m.rows.filter(r=>byRut.has(r.rut)).map(r=>[r.grade<4?'Sí':'No',byRut.get(r.rut).risk,r.name,r.rut,r.career,r.subject,r.section,r.teacher,decCell(r.grade),gradeLabel(r.grade),r.review?'Sí':'No']),[18,15,35,20,50,49,15,35,15,27,15])];
}
function cellXml(value,i,row,style=0){
  if(value!==null && typeof value==='object'){style=value.style;value=value.v;}
  const cell=colName(i)+row;
  if(value==null||value==='')return '<c r="'+cell+'" s="'+style+'"/>';
  if(typeof value==='number'&&Number.isFinite(value))return '<c r="'+cell+'" s="'+style+'"><v>'+value+'</v></c>';
  return '<c r="'+cell+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
}
function sheetXml(t,m){
  const rows=t.rows,columns=t.heads.length,lastCol=colName(columns-1),bottom=rows.length+4;
  const r=(n,values,style,height)=>'<row r="'+n+'"'+(height?' ht="'+height+'" customHeight="1"':'')+'>'+values.map((v,i)=>cellXml(v,i,n,style)).join('')+'</row>';
  const details=rows.map((v,i)=>r(i+5,v,0,t.tall?Math.min(350,Math.max(52,Math.max(...v.map((f,j)=>Math.ceil(String(f??'').length/Math.max(1,t.widths[j]-6))))*17)):0)).join('');
  return XML+'<worksheet xmlns="'+X+'" xmlns:r="'+OFFICE+'"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="21"/><cols>'+t.widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+r(1,[t.title],1,34)+r(2,[period(m)+' · '+school+' · Uso interno'],2,23)+r(4,t.heads,3,38)+details+'</sheetData><autoFilter ref="A4:'+lastCol+bottom+'"/><mergeCells count="2"><mergeCell ref="A1:'+lastCol+'1"/><mergeCell ref="A2:'+lastCol+'2"/></mergeCells>'+(t.chart?'<drawing r:id="rIdChart"/>':'')+'</worksheet>';
}
const styles=XML+'<styleSheet xmlns="'+X+'"><fonts count="4"><font><sz val="11"/><color rgb="FF233B50"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF35516A"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF163A5B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5EFF6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B5B88"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6">'+[[0,0,0],[1,2,0],[2,3,0],[3,4,0],[0,0,10],[0,0,2]].map(([f,fill,num])=>'<xf numFmtId="'+num+'" fontId="'+f+'" fillId="'+fill+'" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>').join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
function chartParts(z,m){
  const c='http://schemas.openxmlformats.org/drawingml/2006/chart',a='http://schemas.openxmlformats.org/drawingml/2006/main',d='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
  const md=m.analysis.summary,vals=[md.absent,md.notTaken,md.failed,md.passed],cats=['Sin participación','No rindieron','Rindieron y reprobaron','Rindieron y aprobaron'];
  const cache=(items,kind)=>'<c:'+kind+'Cache>'+(kind==='num'?'<c:formatCode>0</c:formatCode>':'')+'<c:ptCount val="'+items.length+'"/>'+items.map((v,i)=>'<c:pt idx="'+i+'"><c:v>'+xml(v)+'</c:v></c:pt>').join('')+'</c:'+kind+'Cache>';
  const ref=(column,items,kind)=>'<c:'+kind+'Ref><c:f>\'Participación\'!$'+column+'$5:$'+column+'$8</c:f>'+cache(items,kind)+'</c:'+kind+'Ref>';
  const axis=(tag,id,cross,pos)=>'<c:'+tag+'><c:axId val="'+id+'"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="'+pos+'"/><c:tickLblPos val="nextTo"/><c:crossAx val="'+cross+'"/><c:crosses val="autoZero"/></c:'+tag+'>';
  z.file('xl/charts/chart1.xml',XML+'<c:chartSpace xmlns:c="'+c+'" xmlns:a="'+a+'"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Participación y desempeño</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Inscripciones</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="20679B"/></a:solidFill></c:spPr><c:cat>'+ref('A',cats,'str')+'</c:cat><c:val>'+ref('B',vals,'num')+'</c:val></c:ser><c:dLbls><c:showVal val="1"/></c:dLbls><c:axId val="10"/><c:axId val="20"/></c:barChart>'+axis('catAx',10,20,'l')+axis('valAx',20,10,'b')+'</c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>');
  const anchor=(tag,col,row)=>'<xdr:'+tag+'><xdr:col>'+col+'</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+row+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:'+tag+'>';
  z.file('xl/drawings/drawing1.xml',XML+'<xdr:wsDr xmlns:xdr="'+d+'" xmlns:a="'+a+'" xmlns:r="'+OFFICE+'"><xdr:twoCellAnchor>'+anchor('from',4,3)+anchor('to',15,17)+'<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Participación y desempeño"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="'+c+'"><c:chart xmlns:c="'+c+'" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>');
  z.file('xl/worksheets/_rels/sheet1.xml.rels',relationships([['rIdChart','drawing','../drawings/drawing1.xml']]));z.file('xl/drawings/_rels/drawing1.xml.rels',relationships([['rId1','chart','../charts/chart1.xml']]));
}
function workbook(m,isDashboard){
  const z=new globalThis.JSZip(),tabs=isDashboard?dashboardSheets(m):contactSheets(m);
  const types=[['xl/workbook.xml','spreadsheetml.sheet.main'],['xl/styles.xml','spreadsheetml.styles']];
  const relations=[['rIdStyle','styles','styles.xml']];
  const sheets=tabs.map((tab,i)=>{
    const number=i+1,name='worksheets/sheet'+number+'.xml';z.file('xl/'+name,sheetXml(tab,m));types.push(['xl/'+name,'spreadsheetml.worksheet']);relations.push(['rId'+number,'worksheet',name]);return '<sheet name="'+xml(tab.name)+'" sheetId="'+number+'" r:id="rId'+number+'"/>';});
  if(isDashboard){chartParts(z,m);types.push(['xl/charts/chart1.xml','drawingml.chart'],['xl/drawings/drawing1.xml','drawing']);}
  z.file('[Content_Types].xml',contentTypes(types));z.file('_rels/.rels',relationships([['rId1','officeDocument','xl/workbook.xml']]));z.file('xl/styles.xml',styles);
  z.file('xl/workbook.xml',XML+'<workbook xmlns="'+X+'" xmlns:r="'+OFFICE+'"><bookViews><workbookView activeTab="0"/></bookViews><sheets>'+sheets.join('')+'</sheets></workbook>');z.file('xl/_rels/workbook.xml.rels',relationships(relations));return z;
}
export async function generateOffice(kind,model){
  if(!Object.hasOwn(formats,kind))throw Error('Formato de descarga desconocido.');
  if(!globalThis.JSZip)throw Error('Falta el componente local de exportación Office.');
  if(!model?.analysis?.summary || !Array.isArray(model.rows))throw Error('Seleccione un cierre validado para exportar.');
  const [label,ext,mime]=formats[kind],z=kind==='informe'?wordReport(model):kind==='presentacion'?await presentation(model):workbook(model,kind==='tablero');
  const blob=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3},mimeType:'application/vnd.openxmlformats-officedocument.'+mime});
  return {blob,filename:label+'_IPG_Ciclo'+model.cycle+'_'+model.year+'.'+ext};
}

/* Ficha individual de seguimiento descargable. Sólo usa los datos que la API autorizó al usuario. */
export async function generateCaseSheet({period:cycleId,caseData,tracking}){
 if(!globalThis.JSZip)throw Error('Falta el componente local de exportación Word.');
 if(!caseData?.rut||!tracking)throw Error('La ficha no está disponible.');
 const z=new globalThis.JSZip();
 const para=(value,bold=false)=>'<w:p><w:r>'+(bold?'<w:rPr><w:b/></w:rPr>':'')+'<w:t xml:space="preserve">'+xml(value)+'</w:t></w:r></w:p>';
 const when=value=>value?new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(value)):'—';
 const paras=[
  para('IPG · Escuela de Gestión, Negocios y Marítima',true),
  para('FICHA INDIVIDUAL DE SEGUIMIENTO ACADÉMICO',true),
  para('Documento de evidencia de gestión · '+String(cycleId||'')),
  para('Estudiante: '+String(caseData.name||tracking.name||'')),
  para('RUT: '+String(caseData.rut)),
  para('Carrera: '+String(caseData.career||tracking.career||'')),
  para('Estado del caso: '+(tracking.closed?'CERRADO':'ABIERTO'),true),
  para('Responsable asignado: '+String(tracking.assignee||'Sin asignar')),
  para('Supervisión institucional: Dirección de Escuela'+(tracking.supervisor?' · '+tracking.supervisor:'')),
  para('La identificación de supervisión no constituye firma, aprobación ni validación de las gestiones.'),
  para('Fecha de cierre: '+when(tracking.closed_at)),
  para('Cierre registrado por: '+String(tracking.closed_by||'—')),
  para('ANTECEDENTES ACADÉMICOS',true)
 ];
 for(const s of caseData.subjects||[])paras.push(para(String(s.subject||'Asignatura')+' · Sección '+String(s.section||'—')+' · Nota final '+(Number.isFinite(s.grade)?s.grade.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1}):'—')));
 paras.push(para('HISTORIAL DE GESTIONES',true));
 const events=[...(tracking.events||[])].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 if(!events.length)paras.push(para('No registra intervenciones.'));
 for(let i=0;i<events.length;i++){
  const e=events[i];
  paras.push(para('Gestión '+(i+1)+' · '+when(e.created_at)+' · '+String(e.outcome||'—'),true));
  paras.push(para('Responsable de la gestión: '+String(e.author||'—')));
  paras.push(para('Canal: '+String(e.channel||'—')));
  paras.push(para('Gestión realizada y acuerdos: '+String(e.note||'—')));
  if(e.csd)paras.push(para('Recurso recomendado: '+e.csd));
  if(e.referral)paras.push(para('Derivación: '+e.referral));
  if(e.next_date)paras.push(para('Próximo seguimiento previsto: '+e.next_date));
 }
 paras.push(para('Registro generado: '+when(new Date().toISOString())));
 paras.push(para('Evidencia administrativa basada en las gestiones registradas en la plataforma. No sustituye una firma o validación institucional.'));
 const doc=XML+'<w:document xmlns:w="'+W+'"><w:body>'+paras.join('')+'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>';
 z.file('[Content_Types].xml',contentTypes([['word/document.xml','wordprocessingml.document.main']]));
 z.file('_rels/.rels',relationships([['rId1','officeDocument','word/document.xml']]));
 z.file('word/document.xml',doc);
 const blob=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
 const safeRut=String(caseData.rut).replace(/[^0-9kK-]/g,'_');
 return {blob,filename:'Ficha_Seguimiento_'+safeRut+'_'+String(cycleId||'').replace(/[^0-9-]/g,'')+'.docx'};
}
