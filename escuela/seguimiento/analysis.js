// Motor del cierre de nivel. La unidad de rendimiento es la inscripción y la de contacto es la persona.
const text = value => String(value ?? '').trim();
const norm = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const fields = {
  studentCode:['codalumno','codigoalumno','codigoestudiante'], rut:['rut','rutalumno','rutestudiante','rutcompleto'],
  dv:['dv','dvalumno'], first:['nombre','nombres','nombrealumno'], last:['paterno','apellidopaterno'], last2:['materno','apellidomaterno'],
  subjectCode:['codasignatura','codigoasignatura'], subject:['nomasignatura','nombreasignatura','asignatura'],
  careerCode:['codcarrera','codigocarrera'], career:['nomcarreraalumno','nombredelacarreradelalumno','carreraalumno','carreradelestudiante','nombrecarrera'],
  planned:['nomcarreraplanif','nomcarreraplanificada','carreraplanificada'], section:['seccion'], level:['nivel'], cohort:['cohorte'],
  line:['areaconoc','areaconocimiento','lineacurricular'], school:['escuela'], modality:['modcarrera','modalidadcarrera'],
  grade:['notafinal','notafinalasignatura'], p1:['notasol1','notasolemne1'], p2:['notasol2','notasolemne2'], p3:['notasol3','notasolemne3'],
  teacherId:['rutdocente'], sede:['sede'], teacher:['docente','nombredocente']
};
const required=['studentCode','rut','subjectCode','subject','careerCode','career','section','grade','line','school','modality','level','cohort'];
const titles={studentCode:'código de alumno',rut:'RUT',subjectCode:'código de asignatura',subject:'nombre de asignatura',careerCode:'código de carrera',career:'carrera del alumno',section:'sección',grade:'nota final',line:'área de conocimiento',school:'escuela',modality:'modalidad de carrera',level:'nivel',cohort:'cohorte'};
const lines = new Map([['conocimientosbasicos','Conocimientos Básicos'],['especialidadtecnica','Especialidad Técnica'],['personalsocial','Personal y Social'],['personalysocial','Personal y Social'],['practica','Práctica'],['sinarea','Sin área']]);
const targets=new Map([['Conocimientos Básicos',.80],['Especialidad Técnica',.80],['Personal y Social',.85],['Práctica',.85]]);
export const gradeLabels={absent:'Sin participación',notTaken:'No rindió evaluaciones',failed:'Rindió y reprobó',passed:'Rindió y aprobó'};
export function gradeStatus(grade){ return grade===0?'absent':grade===1?'notTaken':grade<4?'failed':'passed'; }
function number(value){ if(value==null||text(value)==='')return null;const n=Number(text(value).replace(',','.'));return Number.isFinite(n)?n:null;}
function readLine(value){const s=text(value).replace(/^l[ií]nea\s+curricular\s*/i,'');return lines.get(norm(s)) || s || 'Sin área';}
function rutKey(body,check){
  const a=text(body).replace(/[.\s]/g,'').toUpperCase();const m=a.match(/^(\d{1,9})-([\dK])$/);
  const base=m?m[1]:a,dv=m?m[2]:text(check).toUpperCase();
  if(!/^\d{1,9}$/.test(base)||!/^([\dK])$/.test(dv))return '';
  return String(Number(base))+'-'+dv;
}
const children=(node,tag)=>Array.from(node.getElementsByTagNameNS('*',tag));
function xml(value){
  const d=new DOMParser().parseFromString(value,'application/xml');
  if(d.getElementsByTagName('parsererror').length)throw Error('No se pudo leer el contenido XML del archivo Excel.');
  return d;
}
async function xmlFile(zip,path){
 const file=zip.file(path);if(!file)throw Error('El libro no contiene la estructura esperada de Excel.');
 const value=await file.async('string');if(value.length>65_000_000)throw Error('La hoja excede el tamaño admitido.');
 return xml(value);
}
function pathFor(target){return new URL(target,'https://libro.local/xl/workbook.xml').pathname.slice(1);}
function matrix(doc,strings){
  return children(doc,'row').map((row,index)=>{
    const cells=[];
    for(const c of children(row,'c')){
      const col=c.getAttribute('r')?.match(/^[A-Z]+/)?.[0];
      const j=col?[...col].reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0)-1:cells.length;
      if(j>180)continue;
      const type=c.getAttribute('t'),v=c.getElementsByTagNameNS('*','v')[0]?.textContent;
      cells[j]=type==='s'?(strings[Number(v)]??''):type==='inlineStr'?children(c,'t').map(t=>t.textContent).join(''):(v??'');
    }
    return {n:Number(row.getAttribute('r'))||index+1,cells};
  });
}
function indices(cells) {
 const labels=cells.map(norm),out={};
 for(const [f,aliases] of Object.entries(fields))out[f]=labels.findIndex(v=>aliases.includes(v));
 // En los consolidados U+ hay dos juegos de apellido/nombre/DV. El segundo sigue a RUT Docente.
 if(out.teacherId>=0){
   for(const f of ['first','last','last2'])out['teacher'+f]=labels.findIndex((v,i)=>i>out.teacherId&&fields[f].includes(v));
 }
 return out;
}
function extract(periodRows,sheetName) {
 const preamble=periodRows.flatMap(r=>r.cells.filter(Boolean)).join(' ');
 const year=Number(preamble.match(/A[ñn]o\s*:\s*(20\d{2})/i)?.[1])||null;
 const cycle=Number(preamble.match(/(?:Per[ií]odo|Ciclo)\s*:\s*(\d{1,2})\b/i)?.[1]||sheetName.match(/Ciclo[ _-]*(\d{1,2})\b/i)?.[1])||null;
 return {year,cycle};
}
export function parseRows(data,sheet=''){
 const header=data.slice(0,45).findIndex(r=>{const idx=indices(r.cells);return idx.grade>=0&&idx.subjectCode>=0});
 if(header<0)throw Error('No se encontraron los encabezados Nota Final y Código de Asignatura del consolidado U+.');
 const idx=indices(data[header].cells);
 const legacy=idx.modality<0&&norm(data[header].cells[idx.career])==='nombrecarrera'&&idx.sede>=0&&/^notasfinales/.test(norm(sheet));
 const missing=required.filter(f=>idx[f]<0&&!(legacy&&f==='modality'));
 if(missing.length)throw Error('Faltan columnas del consolidado U+: '+missing.map(f=>titles[f]).join(', ')+'.');
 const {year,cycle}=extract(data.slice(0,header),sheet);
 const rows=[], errors=[], warnings=[],seen=new Map();
 let excluded=0, duplicates=0,invalid=0;
 const issue=(n,msg)=>{invalid++;if(errors.length<30)errors.push('Fila '+n+': '+msg);};
 for(const {n,cells} of data.slice(header+1)){
   if(!cells.some(v=>text(v)))continue;
   const get=f=>text(cells[idx[f]]), school=norm(get('school')), modality=norm(get('modality'));
   if(!school||(!legacy&&!modality)){issue(n,'falta escuela o modalidad de carrera.');continue;}
   if(!['escueladegestionnegociosymaritima','escuelagestionnegociosymaritima','gestionnegociosymaritima'].includes(school)||(!legacy&&!['virtual','online','enlinea'].includes(modality))){excluded++;continue;}
   const rut=rutKey(get('rut'),get('dv')), grade=number(get('grade'));
   const keys=['studentCode','careerCode','career','subjectCode','subject','section'];
   if(!rut||keys.some(f=>!get(f))){issue(n,'identificación de estudiante, carrera, asignatura o sección incompleta.');continue;}
   if(!(grade===0||(grade>=1&&grade<=7&&Math.abs(grade*10-Math.round(grade*10))<1e-7))){issue(n,'nota final vacía o fuera de la escala 0,0 y 1,0–7,0 (un decimal).');continue;}
   const partials=['p1','p2','p3'].map(f=>number(get(f)));
   const row={rut,name:['first','last','last2'].map(get).filter(Boolean).join(' ')||rut,studentCode:get('studentCode'),
     careerCode:get('careerCode'),career:get('career'),subjectCode:get('subjectCode'),subject:get('subject'),
     section:get('section'),level:get('level')||'Sin nivel',line:readLine(get('line')),cohort:get('cohort')||'Sin cohorte',
     teacher:get('teacher')||['teacherfirst','teacherlast','teacherlast2'].map(get).filter(Boolean).join(' ')||'Sin docente',
     grade,review:grade===0&&partials.some(v=>v!==null&&v>0),partials,planned:get('planned'),sede:get('sede')};
   const key=JSON.stringify([row.studentCode,row.careerCode,row.subjectCode,row.section]);
   const signature=JSON.stringify(row);
   if(seen.has(key)){
     duplicates++;
     if(seen.get(key)!==signature)issue(n,'registro duplicado con información distinta. Revise la inscripción antes de importar.');
     continue;
   }
   seen.set(key,signature);rows.push(row);
 }
 if(invalid>errors.length)errors.push('Otras '+(invalid-errors.length)+' filas requieren revisión.');
 if(!rows.length)errors.push('No hay inscripciones válidas de la Escuela en modalidad virtual.');
 if(duplicates)warnings.push('Inscripciones repetidas detectadas: '+duplicates+'. Las copias idénticas se cuentan una sola vez.');
 const unknown=new Set(rows.filter(r=>!targets.has(r.line)).map(r=>r.line));
 if(legacy)warnings.push('Formato histórico de notas finales sin modalidad de carrera. Se incluyen todas las filas de la Escuela, también las adscritas a otras sedes.');
 if(unknown.size)warnings.push('Líneas sin meta de aprobación: '+Array.from(unknown).join(', ')+'.');
 return {rows,year,cycle,sheet,excluded,duplicates,errors,warnings,invalid};
}
export async function parseWorkbook(bytes,JSZip=globalThis.JSZip){
 if(!JSZip)throw Error('No se pudo cargar el lector de Excel.');
 const zip=await JSZip.loadAsync(bytes);
 const book=await xmlFile(zip,'xl/workbook.xml'),rels=await xmlFile(zip,'xl/_rels/workbook.xml.rels');
 const relationships=new Map(children(rels,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),pathFor(r.getAttribute('Target'))]));
 const ss=zip.file('xl/sharedStrings.xml');const strings=ss?children(await xmlFile(zip,'xl/sharedStrings.xml'),'si').map(s=>children(s,'t').map(t=>t.textContent).join('')):[];
 const sheets=children(book,'sheet').map(s=>({name:s.getAttribute('name'),path:relationships.get(s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||s.getAttribute('r:id'))}));
 const score=s=>norm(s.name).includes('notasconsolidado')?2:norm(s.name).includes('notasfinales')?1:0;
 sheets.sort((a,b)=>score(b)-score(a));
 for(const s of sheets){
    if(!s.path||!s.path.startsWith('xl/worksheets/'))continue;
    const data=matrix(await xmlFile(zip,s.path),strings);
    if(!data.slice(0,45).some(({cells})=>{const i=indices(cells);return i.grade>=0&&i.subjectCode>=0;}))continue;
    return parseRows(data,s.name);
 }
 throw Error('No se encontró una hoja de cierre U+ con nota final, carrera y asignatura.');
}
const ratio=(a,b)=>b?a/b:null;
function metrics(rows){
 const students=new Set(),codes=new Set(),grades=[];let passed=0,failed=0,notTaken=0,absent=0,review=0,sum=0;
 for(const r of rows){
  students.add(r.rut);codes.add(r.studentCode);if(r.review)review++;
  if(r.grade===0)absent++;else if(r.grade===1)notTaken++;else {if(r.grade<4)failed++;else passed++;sum+=r.grade;grades.push(r.grade);}
 }
 grades.sort((a,b)=>a-b);const evaluated=grades.length,mid=Math.floor(evaluated/2);
 return {total:rows.length,evaluated,passed,failed,absent,notTaken,review,students:students.size,studentCodes:codes.size,
   coverage:ratio(evaluated,rows.length),approval:ratio(passed,evaluated),failureRate:ratio(failed,evaluated),overallApproval:ratio(passed,rows.length),
   mean:ratio(sum,evaluated),median:evaluated?(grades[mid]+grades[(evaluated-1)>>1])/2:null};
}
function buckets(rows,fields){
 const m=new Map();for(const r of rows){const k=JSON.stringify(fields.map(f=>r[f]));if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return [...m.values()];
}
function groupStats(rows,keys,labels=keys){
 return buckets(rows,keys).map(items=>({...Object.fromEntries(labels.map(f=>[f,items[0][f]])),...metrics(items)}));
}
function subjectStats(rows){
 const base=rows[0],stats=metrics(rows),ls=[...new Set(rows.map(r=>r.line))];
 const ts=[...new Set(ls.map(l=>targets.get(l)??null))];const target=ts.length===1?ts[0]:null;
 const gap=target!=null&&stats.approval!=null?100*(stats.approval-target):null;
 const severeSections=target==null?0:buckets(rows,['section']).filter(section=>{const s=metrics(section);return s.approval!==null&&target-s.approval>.15+1e-10;}).length;
 let status='Sin clasificación';
 if(gap!=null){
  status=gap>=-1e-8?'Verde':gap>=-10-1e-8?'Amarillo':gap< -15-1e-8&&(stats.studentCodes>=30||severeSections>=2)?'Rojo prioritario':'Rojo';
 }
 return {careerCode:base.careerCode,career:base.career,subjectCode:base.subjectCode,subject:base.subject,line:ls.join(' / '),target,gap,status,severeSections,...stats};
}
export function suggestedAction(c){
 const opening=c.absent?'Consultar qué dificultó la participación.':c.notTaken?'Consultar qué dificultó rendir las evaluaciones.':'Preguntar qué contenidos le resultaron difíciles.';
 return 'Contactar al estudiante. '+opening+' Recomendar el Centro de Simulación Digital (CSD) para reforzar contenidos. Si comunica una dificultad, derivarla al área correspondiente.'+(c.review?' Verificar el cierre con Registro Curricular.':'');
}
export function analyze(rows){
 const summary=metrics(rows),affected=rows.filter(r=>r.grade<4);
 const cases=buckets(affected,['rut']).map(items=>{
   const r=items[0],stats=metrics(items);
   return {rut:r.rut,name:r.name,careerCode:[...new Set(items.map(i=>i.careerCode))].join(' / '),career:[...new Set(items.map(i=>i.career))].join(' / '),
    risk:items.length>=3?'Alto':items.length===2?'Medio':'Bajo',affected:items.length,absent:stats.absent,notTaken:stats.notTaken,failed:stats.failed,review:stats.review,subjects:items};
 }).sort((a,b)=>b.affected-a.affected||a.name.localeCompare(b.name,'es'));
 const rank=['Rojo prioritario','Rojo','Amarillo','Sin clasificación','Verde'];
 const subjects=buckets(rows,['careerCode','subjectCode']).map(subjectStats).sort((a,b)=>rank.indexOf(a.status)-rank.indexOf(b.status)||(a.gap??0)-(b.gap??0)||b.failed-a.failed);
 Object.assign(summary,{atRisk:cases.length,highRisk:cases.filter(c=>c.risk==='Alto').length,mediumRisk:cases.filter(c=>c.risk==='Medio').length,
  lowRisk:cases.filter(c=>c.risk==='Bajo').length,subjectCombinations:subjects.length,subjectCodes:new Set(rows.map(r=>r.subjectCode)).size,
  statusCounts:Object.fromEntries(rank.map(s=>[s,subjects.filter(r=>r.status===s).length]))});
 return {summary,subjects,cases,careers:groupStats(rows,['careerCode'],['careerCode','career']),
  levels:groupStats(rows,['level']).sort((a,b)=>String(a.level).localeCompare(String(b.level),'es',{numeric:true})),
  lines:groupStats(rows,['line']).map(g=>({...g,target:targets.get(g.line)??null})),cohorts:groupStats(rows,['cohort']),
  sections:groupStats(rows,['careerCode','subjectCode','section','teacher'],['careerCode','career','subjectCode','subject','section','teacher']),
  teachers:groupStats(rows,['teacher'])};
}
