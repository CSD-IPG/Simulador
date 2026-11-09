# FIN-SIM V2 · Dos modalidades

La práctica original conserva su almacenamiento `ipg_finsim_v1`. La modalidad laboral utiliza un espacio separado por correo institucional, con un intento vigente por desafío. Cada nuevo intento solicita confirmación antes de reemplazar el anterior y permite descargarlo previamente.

## Encargos y propósitos formativos

| Caso | Rol | Tareas y evidencia |
| --- | --- | --- |
| F01 | Analista de tesorería | Diagnosticar liquidez; distinguir cobros de ventas; aplicar medidas y conciliar caja; informar compromisos futuros. |
| F02 | Analista de control de gestión | Identificar deterioro del margen; comparar medidas operativas con financiamiento; actualizar EBITDA y caja; formular seguimiento. |
| F03 | Responsable de planificación financiera | Actualizar cierre por menor demanda; combinar medidas comerciales y operativas; revisar inventario, margen y caja; comunicar brechas. |

Son propósitos del recurso. La correspondencia formal con perfiles de egreso y resultados de aprendizaje institucionales requiere validar los programas vigentes. La participación puede ser autónoma o contar con acompañamiento académico opcional.

Todos los importes son ficticios y están expresados en MM. Se mantienen explícitos los supuestos de clasificación, reconocimiento y pago. No se presentan como una liquidación tributaria ni un estado financiero completo.

## Reglas y retroalimentación

- Diagnóstico inicial: EBITDA = 112 − 72 − 21 = 19; caja = 14 + 93 − 89 − 9 − 3 = 6.
- La contingencia se aplica una sola vez después de validar diagnóstico y prioridad.
- Se admiten como máximo dos medidas distintas; la proyección no ejecuta una medida.
- Crédito incrementa caja y deuda; su costo financiero no reduce EBITDA. Una inversión diferida libera caja sin mejorar EBITDA.
- Cierre: verifica ventas, EBITDA y caja con tolerancia de 0,05 MM. Se puede cerrar bajo meta, conservando la brecha en el informe.
- Progreso de tareas: 35% diagnóstico, 25% por medida (máximo 85%), 100% al conciliar y registrar informe.
- Verificación cuantitativa: 40 puntos por diagnóstico, 30 por cierre conciliado y 15 por cada meta financiera alcanzada. La longitud o calidad de los textos no agrega puntos.
- La fundamentación escrita se registra para autoevaluación o revisión académica opcional. Una extensión mínima permite conservar un desarrollo; no significa que su calidad haya sido evaluada.

## Guardado y registro

La identificación se reutiliza desde el acceso del CSD. No se exige docente, asignatura ni sección para iniciar un desafío. Los borradores, decisiones y tiempos se guardan en el navegador. Se requiere el mismo dispositivo y navegador para retomar; no existe restauración desde el registro central.

El registro institucional reutiliza las columnas existentes de `participaciones`, con sesión propia y actividad `LAB-Fxx · intento n`. Se envían resúmenes de inicio, avance y cierre; la evidencia detallada permanece local y es descargable como JSON, CSV o impresión PDF. No se agregan columnas ni se modifican permisos. Los envíos pendientes se conservan y pueden reintentarse. Las pruebas de UI utilizan respuestas locales de demostración, sin insertar datos ficticios en producción.

## Verificación

`node finanzas/laboral.test.cjs`

Prueba los tres casos con resultados esperados, precedencia de fases, cifras inválidas, medidas duplicadas, límite de medidas, proyección sin mutación, crédito, inversión y cierre bajo meta. Los recorridos de navegador cubren los tres cierres, error numérico, pausa y reanudación, conservación de borradores, descargas y separación de modalidades.
