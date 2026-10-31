/* Ruta CSD Impulsa: comprobación de diagnóstico en este navegador.
   No verifica identidad ni constituye control de autorización del servidor. */
(()=>{'use strict';
const KEY='csd_impulsa_diagnostico_habilitacion_v1';
function gate(){
 const saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}})();
 const valid=saved&&saved.version===1&&saved.completed===true&&Number.isFinite(saved.timestamp)&&Date.now()-saved.timestamp<90*24*3600*1000&&saved.timestamp<=Date.now();
 if(valid)return;
 const style=document.createElement('style');style.textContent='#rutaGate{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:22px;background:#06152af5;color:#f3faff;font:16px system-ui;overflow:auto}#rutaGate article{max-width:590px;background:linear-gradient(130deg,#153e58,#11243e);border:1px solid #6090a6;border-radius:20px;padding:30px;box-shadow:0 20px 70px #0009}#rutaGate h2{color:#fff;font-size:27px}#rutaGate p{color:#d1e5f3;line-height:1.6}#rutaGate a{display:inline-block;padding:13px 20px;border-radius:10px;background:#69dce7;color:#07273a;font-weight:800;text-decoration:none}';
 document.head.append(style);
 const dialog=document.createElement('div');dialog.id='rutaGate';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
 const box=document.createElement('article'),title=document.createElement('h2'),info=document.createElement('p'),link=document.createElement('a');
 title.textContent='Diagnóstico inicial requerido';info.textContent='Este módulo corresponde a la Ruta de Inicio de CSD Impulsa. Para acceder debes haber completado el diagnóstico integral en este navegador. Los módulos de nivelación 2 están disponibles para uso independiente.';link.href='../impulsa/';link.textContent='Ir al diagnóstico CSD Impulsa →';
 box.append(title,info,link);dialog.append(box);document.body.append(dialog);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',gate);else gate();
})();
