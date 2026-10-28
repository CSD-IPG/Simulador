# Validación WMS V3.9 y trazabilidad CSD IPG

## Alcance
Rama de desarrollo, sin publicación automática en main.

## Diagnóstico verificado
- main/wms/index.html corresponde a V3.7.
- El módulo V3.9 desarrollado fuera de GitHub incluye acta de diferencia para OC-1002.
- Supabase public.participaciones tiene RLS, con INSERT permitido al rol anon mediante WITH CHECK (true).
- No existe una tabla específica de resultados de desafíos en el esquema público examinado.
- Se identificaron columnas históricas duplicadas por mayúsculas/minúsculas en participaciones.

## Pruebas de aceptación previas a producción
1. Gestión libre: iniciar, operar recepción/picking/packing/despacho sin desafío activo; persistencia separada.
2. D01: OC-1002 recibir 17, condición Con diferencia, documentar acta y acción correctiva; 100% solo con tres hitos.
3. D02: prioridad alta, verificar ambos despachos.
4. D03: registrar reposición antes del despacho.
5. D04: comprobar error de ubicación y recuperación operativa.
6. D05: respetar prioridad de despacho y justificar decisión.
7. D06: recepciones, despachos, contingencia y evidencia final.
8. Exportación de evidencia, reinicio, reanudación, identificación y retorno al portal.
9. Trazabilidad: eventos diferenciados por modo, id de desafío, session_id, resultado y fecha; evitar duplicaciones.
10. Seguridad: no confiar en correo escrito por el usuario como autenticación; revisar autorización y limitación de inserciones anónimas antes de habilitar registro evaluativo.

## Criterios de publicación
- Mantener una copia de la versión en producción.
- Integrar HTML completo V3.9 en esta rama.
- Revisar cambios y probar en navegador con datos de prueba.
- Diseñar migración SQL aditiva y reversible, sin tocar participaciones históricas.
- Aprobar publicación a main únicamente tras las verificaciones.

## Estado
Plan técnico y rama preparados; no se han cambiado archivos productivos ni tablas.
