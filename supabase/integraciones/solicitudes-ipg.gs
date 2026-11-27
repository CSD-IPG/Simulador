// Cree un proyecto privado independiente en script.google.com.
const endpointIPG = 'https://uegxxazgqvjjqnmpodln.supabase.co/rest/v1/rpc/recibir_solicitudes_ipg';
const clavePublicaIPG = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZ3h4YXpncXZqanFubXBvZGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2OTMxMDksImV4cCI6MjEwNjI2OTEwOX0.93hHsgPuCrPWZma29meYK2w5EDBff4tv80aUky4v_UQ";

function enviarSolicitudesIPG(solicitudes) {
  const clave = PropertiesService.getScriptProperties().getProperty('CLAVE_IPG');
  if (!clave) throw new Error('Falta la propiedad CLAVE_IPG.');
  return UrlFetchApp.fetch(endpointIPG, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: clavePublicaIPG },
    payload: JSON.stringify({ clave, solicitudes }),
    muteHttpExceptions: true
  });
}

function probarAccesoIPG() {
  const respuesta = enviarSolicitudesIPG([]);
  if (respuesta.getResponseCode() !== 400 || JSON.parse(respuesta.getContentText()).message !== 'Lote fuera de rango') {
    throw new Error('La autorización no se pudo verificar. HTTP ' + respuesta.getResponseCode());
  }
  console.log('Acceso autenticado comprobado. Sin datos enviados.');
}

function interpretarMarcaIPG(valor, zona) {
  if (valor instanceof Date) return valor;
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const fechaLocal = new Date(Date.UTC(1899, 11, 30) + Math.round(valor * 86400) * 1000);
    return Utilities.parseDate(fechaLocal.toISOString().slice(0, 19), zona, "yyyy-MM-dd'T'HH:mm:ss");
  }
  const texto = String(valor).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}$/.test(texto)) {
    return Utilities.parseDate(texto, zona, 'd/M/yyyy H:mm:ss');
  }
  return null;
}

function sincronizarSolicitudesIPG() {
  const id = PropertiesService.getScriptProperties().getProperty('PLANILLA_IPG');
  if (!id) throw new Error('Falta la propiedad PLANILLA_IPG.');
  const libro = SpreadsheetApp.openById(id);
  const hoja = libro.getSheets().find(pestana => pestana.getSheetId() === 1634943427);
  if (!hoja) throw new Error('No se encontró la pestaña de respuestas.');
  const filas = hoja.getLastRow() - 1;
  if (filas < 1) return;
  const identificacion = hoja.getRange(2, 1, filas, 3).getValues();
  const tipos = hoja.getRange(2, 12, filas, 1).getDisplayValues();
  const aportes = hoja.getRange(2, 17, filas, 4).getDisplayValues();
  const zona = libro.getSpreadsheetTimeZone();
  const omitidas = [];
  const solicitudes = identificacion.flatMap(([marca, fecha, rut], i) => {
    if (!marca && !rut) return [];
    const documento = String(rut).replace(/[.\s-]/g, '').toUpperCase();
    const tipo = tipos[i][0].trim();
    const enviada = interpretarMarcaIPG(marca, zona);
    if (!enviada || !/^[0-9]{1,8}[0-9K]$/.test(documento) || !tipo) {
      omitidas.push(i + 2);
      return [];
    }
    const [jefatura, registro, administracion, finanzas] = aportes[i].map(valor => valor.trim() || null);
    return [{
      rut: documento, enviada_en: enviada.toISOString(), tipo,
      fecha: fecha instanceof Date ? Utilities.formatDate(fecha, libro.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : null,
      jefatura, registro, administracion, finanzas
    }];
  });
  if (omitidas.length) console.warn('Filas sin datos válidos para vincular: ' + omitidas.join(', '));
  let cambios = 0;
  for (let i = 0; i < solicitudes.length; i += 100) {
    const respuesta = enviarSolicitudesIPG(solicitudes.slice(i, i + 100));
    if (respuesta.getResponseCode() !== 200) throw new Error('Falló el lote ' + (i / 100 + 1) + '. HTTP ' + respuesta.getResponseCode());
    cambios += JSON.parse(respuesta.getContentText());
  }
  console.log('Solicitudes revisadas: ' + solicitudes.length + '. Altas o cambios: ' + cambios);
}

function activarSincronizacionDiariaIPG() {
  probarAccesoIPG();
  const nombre = 'sincronizarSolicitudesIPG';
  if (!ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === nombre)) {
    ScriptApp.newTrigger(nombre).timeBased().everyDays(1).atHour(7).inTimezone('America/Santiago').create();
  }
}
