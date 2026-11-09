/* FIN-SIM: importes ficticios expresados en millones de pesos (MM). */
(function(root){'use strict';
const baseline={sales:112,cogs:72,opex:21,cash:6,borrowed:0,financeCost:0,deferred:0};
const cases=[
{id:'F01',level:'Inicial',title:'La empresa vende, pero no tiene caja',role:'Analista de tesorería',brief:'La gerencia necesita asegurar pagos sin confundir rentabilidad con disponibilidad de efectivo.',event:'Tesorería informa que un cliente posterga un cobro de $18 MM hasta el próximo mes. La venta ya fue reconocida: el atraso modifica caja, no ventas ni EBITDA.',shock:{cash:-18},target:{cash:5,ebitda:18},priority:'cobros',actions:[
{id:'cobranza',name:'Cobranza de otra cartera vencida',detail:'Se recuperan $12 MM de otras facturas ya reconocidas. No corresponde al cliente que acaba de postergar su pago. No genera nuevas ventas.',delta:{cash:12},risk:'Agota la cartera recuperable del mes; vigilar la cobranza futura.'},
{id:'credito',name:'Línea de crédito por $10 MM',detail:'Ingresan $10 MM y se pagan $0,4 MM de costo financiero. Aumenta la deuda en $10 MM. El costo financiero no reduce EBITDA.',delta:{cash:9.6,borrowed:10,financeCost:.4},risk:'Quedan $10 MM de principal por pagar el próximo mes, además de la deuda anterior.'},
{id:'proveedor',name:'Acuerdo de pago con un proveedor',detail:'Se difiere un pago de $6 MM; una tarifa operativa de $0,2 MM se reconoce y paga este mes. Caja +$5,8 MM; EBITDA -$0,2 MM.',delta:{cash:5.8,opex:.2,deferred:6},risk:'El próximo mes deberá cubrirse el pago diferido de $6 MM.'},
{id:'inversion',name:'Postergar inversión no crítica',detail:'Se posterga una compra de activo de $3 MM. Libera caja sin modificar el EBITDA del ejercicio.',delta:{cash:3,deferred:3},risk:'La inversión queda pendiente y puede limitar capacidad futura.'}]},
{id:'F02',level:'Intermedio',title:'Proteger el margen sin detener la operación',role:'Analista de control de gestión',brief:'Debes presentar un plan financiero viable ante un encarecimiento de la operación.',event:'Operaciones confirma un sobrecosto logístico de $6 MM. En este ejercicio se reconoce íntegramente como gasto operacional y se paga este mes: EBITDA y caja disminuyen $6 MM.',shock:{opex:6,cash:-6},target:{cash:3,ebitda:16},priority:'margen',actions:[
{id:'compras',name:'Renegociar el costo de compras',detail:'Un acuerdo reduce en $4 MM el costo de ventas del mes y los pagos del mismo período. No cambia volumen ni calidad en este caso.',delta:{cogs:-4,cash:4},risk:'El descuento depende de mantener el volumen acordado el próximo mes.'},
{id:'precio',name:'Ajuste selectivo de precios',detail:'El mercado del caso admite $5 MM adicionales de ventas, sin cambio de volumen ni costo de ventas. Se cobran $4 MM este mes; $1 MM queda por cobrar.',delta:{sales:5,cash:4},risk:'Monitorear conversión y aceptación: el supuesto de volumen estable deberá verificarse.'},
{id:'credito',name:'Financiar el sobrecosto con deuda',detail:'Ingresan $10 MM de crédito y se paga $0,4 MM de costo financiero. Protege caja, pero no corrige el margen operacional.',delta:{cash:9.6,borrowed:10,financeCost:.4},risk:'Aumenta deuda; el principal se paga el próximo mes y el sobrecosto sigue vigente.'},
{id:'inversion',name:'Postergar inversión no crítica',detail:'Libera $3 MM de caja. No modifica ventas, costos ni EBITDA.',delta:{cash:3,deferred:3},risk:'La inversión continúa pendiente y no resuelve la caída del margen.'}]},
{id:'F03',level:'Avanzado',title:'Reformular el cierre ante menor demanda',role:'Responsable de planificación financiera',brief:'Actualiza el cierre del mes y combina medidas comerciales y operativas para sostener continuidad.',event:'El cierre proyectado reduce ventas un 12%: -$13,44 MM. El costo de ventas variable disminuye $8,64 MM. Cobros bajan $12 MM y pagos bajan $8 MM: caja neta -$4 MM. Los gastos fijos se mantienen.',shock:{sales:-13.44,cogs:-8.64,cash:-4},target:{cash:5,ebitda:17},priority:'demanda',actions:[
{id:'gastos',name:'Reducir gasto operativo no crítico',detail:'Se eliminan $2 MM de gasto y pagos del mes, sin afectar seguridad ni dotación en los supuestos del caso.',delta:{opex:-2,cash:2},risk:'Confirmar que el ahorro sea sostenible y no deteriore el servicio.'},
{id:'precio',name:'Revisar mezcla y precios',detail:'La nueva mezcla aporta $4 MM de ventas con el mismo costo de ventas. Se cobran $3 MM este mes; $1 MM queda por cobrar.',delta:{sales:4,cash:3},risk:'Revisar la aceptación comercial antes de extender el cambio al siguiente mes.'},
{id:'inventario',name:'Reducir compras de inventario',detail:'Se reduce una compra por $4 MM de inventario que no se vendería este mes. Libera caja sin afectar el costo de ventas ya reconocido ni el EBITDA.',delta:{cash:4},risk:'Menor cobertura de inventario: revisar reposición para evitar quiebres el próximo mes.'},
{id:'campana',name:'Activar campaña comercial',detail:'Aporta ventas de $8 MM y costo de ventas de $5 MM. La campaña cuesta $1 MM. Se cobran $6 MM y se pagan $6 MM: caja neta sin cambio; EBITDA +$2 MM.',delta:{sales:8,cogs:5,opex:1,cash:0},risk:'La campaña compromete capacidad comercial; comprobar resultados y cobros pendientes.'}]}
];
const def=id=>cases.find(x=>x.id===id);
const metrics=v=>({...v,ebitda:round(v.sales-v.cogs-v.opex),margin:round((v.sales-v.cogs-v.opex)/v.sales*100)});
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function fresh(id,meta={},attempt=1){if(!def(id))throw Error('Desafío inexistente');return {version:1,id,session:root.crypto.randomUUID(),attempt,meta:{...meta},phase:'diagnostico',values:{...baseline},diagnosis:null,decisions:[],closure:null,errors:0,events:[],elapsed:0,running:true,lastStarted:Date.now(),startedAt:new Date().toISOString(),pending:[],syncStatus:'Avance guardado en este navegador.'}}
function near(a,b){return typeof a==='number'&&Number.isFinite(a)&&Math.abs(a-b)<=.05}
function result(state){const c=def(state.id),m=metrics(state.values);return {cash:m.cash>=c.target.cash-.001,ebitda:m.ebitda>=c.target.ebitda-.001}}
function progress(s){return s.closure?100:s.diagnosis?Math.min(85,35+s.decisions.length*25):0}
function preview(s,id){const a=def(s.id)?.actions.find(a=>a.id===id);if(!a)throw Error('Medida inexistente');const v={...s.values};for(const [k,n]of Object.entries(a.delta))v[k]=round(v[k]+n);return metrics(v)}
function apply(s,type,p={}){
 const c=def(s.id);if(!c)return {ok:false,message:'Caso no válido.'};
 const fail=message=>{s.errors++;return {ok:false,message}};
 if(s.closure)return fail('Este intento está cerrado. Puedes descargarlo o iniciar un nuevo intento.');
 if(type==='diagnostico'){
  if(s.diagnosis)return fail('El diagnóstico ya fue validado.');
  if(!near(p.ebitda,19)||!near(p.cash,6))return fail('Revisa: EBITDA = 112 − 72 − 21. Caja = 14 + 93 − 89 − 9 − 3. Trabaja en MM.');
  if(p.priority!==c.priority)return fail('Revisa el encargo de gerencia: prioriza el indicador vinculado al problema que debes gestionar.');
  s.diagnosis={...p};for(const [k,n]of Object.entries(c.shock))s.values[k]=round(s.values[k]+n);s.phase='decisiones';
 }else if(type==='decision'){
  if(!s.diagnosis)return fail('Primero valida tu diagnóstico financiero.');
  const a=c.actions.find(a=>a.id===p.id);if(!a)return fail('Selecciona una medida disponible.');
  if(s.decisions.some(x=>x.id===p.id))return fail('La medida ya fue aplicada; su efecto no puede duplicarse.');
  if(s.decisions.length>=2)return fail('La gerencia autoriza como máximo dos medidas por intento.');
  if(String(p.reason||'').trim().length<30)return fail('Explica el efecto que buscas y el riesgo que aceptas (al menos 30 caracteres).');
  const before=metrics(s.values),after=preview(s,p.id);for(const k of Object.keys(baseline))s.values[k]=after[k];
  s.decisions.push({id:a.id,name:a.name,reason:p.reason.trim(),risk:a.risk,before,after});
 }else if(type==='cerrar'){
  if(!s.diagnosis||!s.decisions.length)return fail('Valida el diagnóstico y ejecuta al menos una medida antes de cerrar.');
  const m=metrics(s.values);
  if(!near(p.sales,m.sales)||!near(p.ebitda,m.ebitda)||!near(p.cash,m.cash))return fail('Tu cierre no concilia con las operaciones. Revisa ventas, EBITDA y caja después de aplicar las medidas.');
  for(const k of ['conclusion','risk','next'])if(String(p[k]||'').trim().length<40)return fail('Completa conclusión, riesgo y seguimiento con al menos 40 caracteres en cada campo. La extensión permite registrar el informe; no evalúa su calidad.');
  s.closure={...p,goals:result(s),at:new Date().toISOString(),qualitative:'Fundamentación registrada para tu autoevaluación; no calificada automáticamente.'};s.phase='cerrado';
 }else return fail('Acción desconocida.');
 s.events.push({at:new Date().toISOString(),type,values:metrics(s.values),progress:progress(s)});
 return {ok:true,message:type==='diagnostico'?'Diagnóstico verificado. Llegó una nueva comunicación de la empresa.':type==='decision'?'Medida ejecutada. Revisa su efecto en los indicadores y el riesgo pendiente.':'Cierre conciliado. Revisa metas y retroalimentación; un intento cerrado puede quedar bajo las metas.'};
}
root.FinLaboralCore={cases,baseline,def,metrics,fresh,apply,preview,progress,result};
})(globalThis);
