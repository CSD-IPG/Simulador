# Integración WMS V3.9 con Supabase: revisión previa a publicación

Estado: diseño / no aplicar aún a producción.

## Hallazgos verificados (27-10-2026)
- `public.participaciones` tiene RLS pero la política `permitir inserciones desde simuladores` permite `INSERT TO anon WITH CHECK (true)`. Por sí sola no autentica a estudiantes.
- `public.accesos_csd` y `public.resultados_reforzamiento_csd` tienen RLS sin políticas de acceso directo; el flujo puede depender de funciones RPC privilegiadas.
- Los asesores de Supabase señalan funciones `SECURITY DEFINER` invocables por `anon`; se deben revisar sus cuerpos y permisos antes de restringirlas, para evitar romper módulos activos.
- La versión piloto WMS V3.9 conserva trazabilidad básica `participaciones` pero declara que los hitos de desafíos no están sincronizados automáticamente al dashboard.
- El acceso institucional actual se basa en correo declarado y no constituye verificación de identidad.

## Diseño propuesto
1. Mantener `participaciones` y sus registros históricos sin modificaciones destructivas.
2. Añadir identificador de modalidad y desafío a una estructura nueva o a eventos compatibles; conservar session_id, fecha, avance, puntaje, tiempo y resultado.
3. Probar escrituras con usuarios de prueba autenticados; no confiar en nombre, correo o RUT enviados por el navegador.
4. Crear políticas RLS específicas para lectura docente/escuela y escritura de usuario autorizado.
5. Revisar y restringir funciones RPC sensibles, previa comprobación de dependencias.
6. Separar pruebas de datos académicos y verificar dashboard con consultas de solo lectura.

## Estado de entrega
- HTML V3.9 piloto validado por pruebas de lógica; no integrado en GitHub por restricción del canal de escritura de archivo completo.
- No se aplicaron migraciones, no se alteraron políticas ni registros de producción.
- Antes de desplegar: validar D01–D06 en navegador, exportaciones y flujos de acceso; luego revisar el PR.
