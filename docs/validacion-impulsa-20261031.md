# CSD Impulsa: validación del pilotaje (31 de octubre de 2026)

Estado: implementación publicada y validada de extremo a extremo en el sitio y en el Dashboard con una sesión real autorizada de Dirección.

## Cambios

- 30 preguntas iniciales y 30 de salida: 10 por dimensión (Matemática, Office básico y Comprensión Lectora).
- Tramos: <=60 requiere; >60 y <80 sugiere; >=80 no necesita reforzamiento.
- Sin cuentas de participantes, contraseñas, verificación de correo ni RUT.
- Nivelación 1 conserva el requisito local del diagnóstico; Nivelación 2 mantiene acceso libre.
- Eventos inmutables por UUID de intento y etapa. Cada nueva ruta crea otro UUID; reenvíos de la misma etapa son idempotentes.
- Cola de sincronización en la pestaña, reintento cada 30 segundos y al recuperar conexión. Si falla la red, se informa al participante y debe conservar la pestaña abierta hasta confirmar envío.
- Receptor `registrar-impulsa` valida origen, tamaño, campos, dominio, perfil y 30 respuestas. Puntajes calculados en servidor. Salida ligada al diagnóstico mediante capacidad aleatoria cuyo hash se conserva en servidor. No interpreta el correo declarado como identidad verificada.
- El receptor no ofrece lecturas. Límite transaccional por correo (120 etapas/hora), no por IP; evita restringir estudiantes de una red compartida. Al ser un pilotaje público sin verificación de identidad, no garantiza autenticidad del correo declarado.
- Tabla con RLS y sin privilegios directos de anon/authenticated. Escritura solo por receptor con clave de servidor. La ausencia de políticas de tabla es intencional: denegación total para clientes.
- Reporte RPC exige usuario autenticado, perfil escuela activo y filtros de fecha. El Dashboard incorpora correo, carrera, dimensión, perfil, fechas, intentos, evolución y rutas. No se muestra RUT.
- PDF A4 descargable sin dependencias externas, más impresión del informe.

## Evidencia ejecutada

1. Sitio publicado, navegador: diagnóstico ficticio `prueba.csd.ficticia.ui20261031@alumnos.ipg.cl`, carrera TNS en Administración de Empresas.
2. Intento `8e0a70de-dcb6-4d4c-b778-81e789be80dc`: diagnóstico 60/70/80%; salida 100/100/100%. Dos actividades declaradas. Confirmación de sincronización visible. Base de datos y RPC de reporte devuelven los mismos resultados.
3. Seis participantes ficticios simultáneos por HTTP al receptor, alternando estudiante/colaborador: diagnóstico, reenvío idempotente y salida correctos (HTTP 200).
4. Segundo intento del mismo correo concurrente0: ambos intentos conservados; reporte devuelve 1/2 y 2/2.
5. Origen ajeno: HTTP 403. Solicitud inválida: HTTP 400. Usuario autenticado sin rol escuela: SQLSTATE 42501, No autorizado.
6. Privilegios comprobados: anon no puede leer/escribir tabla ni ejecutar reporte/receptor RPC. authenticated tampoco tiene lectura directa de tabla.
7. Reporte RPC probado dentro de transacción con el contexto de un perfil escuela activo, sin modificar perfiles, cuentas ni permisos. Además se completó el inicio de sesión real mediante el formulario seguro del navegador y la comprobación visual del mismo reporte.
8. Descarga real de PDF desde botón del sitio: archivo PDF 1.4, A4, 1 página, válido para Poppler; texto y render revisados. Incluye correo ficticio, intento y tres dimensiones.
9. Word Nivelación 1: test ejecutado, 100%, retroalimentación visible. Matemática Nivelación 1: ingreso sin RUT, inicio de estudio y test 5/5, 100%. Nivelación 2: acceso disponible sin formulario de autenticación.
10. Sintaxis JavaScript y diff sin errores. GitHub Pages: despliegues completados correctamente.

Los datos de prueba están identificados por `prueba.csd.ficticia` y no corresponden a personas reales. No se eliminaron registros históricos.

## Comprobación final completada

Se ingresó con un usuario autorizado real. El Dashboard mostró el intento realizado desde el sitio publicado, sus tres dimensiones, diagnóstico 60/70/80%, salida 100/100/100%, evolución +40/+30/+20 pp y dos actividades declaradas. Se verificaron los filtros por correo, carrera, Matemática y fechas (31 de octubre de 2026), y el participante concurrente0 con intentos 1/2 y 2/2. Evidencia visual revisada, exclusivamente con datos ficticios.

El Dashboard conserva la sesión solo en la pestaña al recargar y vuelve a comprobar el rol escuela activo antes de mostrar datos. Cerrar sesión elimina el token local y los resultados de Impulsa de la vista. No se crearon cuentas administrativas ni se alteraron perfiles para las pruebas.
