-- Lectura mensual completa para Dirección; no altera registros originales.
create or replace function public.reporte_mensual_csd(p_mes date,p_excluir_pruebas boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare inicio timestamptz;fin timestamptz;mes date;resultado jsonb;
begin
 if auth.uid() is null or not public.es_usuario_escuela() then raise exception 'No autorizado' using errcode='42501';end if;
 if p_mes is null then raise exception 'Selecciona un mes';end if;
 mes=date_trunc('month',p_mes)::date;
 inicio=mes::timestamp at time zone 'America/Santiago';
 fin=(mes+interval '1 month')::timestamp at time zone 'America/Santiago';
 with accesos as (
 select a.id,a.fecha,a.email,a.tipo_usuario as perfil,a.modulo,a.session_id,a.carrera_codigo,
 (lower(coalesce(a.email,''))~'^(prueba[._-]|test[._-])' or coalesce(a.modulo,'') ilike 'PRUEBA%') as es_prueba
 from public.accesos_csd a where a.fecha>=inicio and a.fecha<fin
 ), actividades as (
 select p.id,p.fecha,p.email_institucional as email,coalesce(p.simulador,p."Simulador") as modulo,p.session_id,p.evento,coalesce(p.carrera,p."Carrera") as carrera,coalesce(p.actividad,p."Actividad") as actividad,coalesce(p.estado,p."Estado") as estado,coalesce(p.avance,p."Avance") as avance,coalesce(p.puntaje,p."Puntaje") as puntaje,coalesce(p.intentos,p."Intentos") as intentos,
 (lower(coalesce(p.email_institucional,''))~'^(prueba[._-]|test[._-])' or coalesce(p.simulador,p."Simulador",'') ilike 'PRUEBA%' or coalesce(p.nombre,p."Nombre",'') ilike 'prueba%') as es_prueba
 from public.participaciones p where p.fecha>=inicio and p.fecha<fin
 ), evaluaciones as (
 select r.id,r.fecha,r.email_declarado as email,r.modulo,r.sesion as session_id,r.evento,r.unidad,r.puntaje,r.intento,r.avance,
 (lower(coalesce(r.email_declarado,''))~'^(prueba[._-]|test[._-])' or coalesce(r.modulo,'') ilike 'PRUEBA%') as es_prueba
 from public.resultados_reforzamiento_csd r where r.fecha>=inicio and r.fecha<fin
 ), impulsa as (
 select e.attempt_id,e.stage as etapa,e.fecha,e.email,e.perfil,e.carrera,e.scores as correctas_por_dimension,e.activities as actividades_declaradas,
 lower(e.email)~'^(prueba[._-]|test[._-])' as es_prueba
 from public.impulsa_eventos_v2 e where e.fecha>=inicio and e.fecha<fin
 ), descargas as (
 select d.id,d.fecha,u.email::text,d.tipo_usuario as perfil,d.rol,d.recurso_id,r.titulo,r.carrera,r.asignatura,r.tipo_recurso,
 lower(coalesce(u.email::text,''))~'^(prueba[._-]|test[._-])' as es_prueba
 from public.descargas_recursos d left join auth.users u on u.id=d.usuario_id left join public.recursos_academicos r on r.id=d.recurso_id where d.fecha>=inicio and d.fecha<fin
 )
 select jsonb_build_object(
 'version','csd-mensual-v1','mes',to_char(mes,'YYYY-MM'),'zona_horaria','America/Santiago','desde',inicio,'hasta_exclusivo',fin,'generado_en',clock_timestamp(),'excluye_pruebas',p_excluir_pruebas,
 'accesos',coalesce((select jsonb_agg(to_jsonb(a) order by a.fecha,a.id) from accesos a where not p_excluir_pruebas or not a.es_prueba),'[]'::jsonb),
 'actividades',coalesce((select jsonb_agg(to_jsonb(a) order by a.fecha,a.id) from actividades a where not p_excluir_pruebas or not a.es_prueba),'[]'::jsonb),
 'evaluaciones',coalesce((select jsonb_agg(to_jsonb(a) order by a.fecha,a.id) from evaluaciones a where not p_excluir_pruebas or not a.es_prueba),'[]'::jsonb),
 'impulsa',coalesce((select jsonb_agg(to_jsonb(a) order by a.fecha,a.attempt_id,a.etapa) from impulsa a where not p_excluir_pruebas or not a.es_prueba),'[]'::jsonb),
 'descargas',coalesce((select jsonb_agg(to_jsonb(a) order by a.fecha,a.id) from descargas a where not p_excluir_pruebas or not a.es_prueba),'[]'::jsonb),
 'pruebas_identificadas',jsonb_build_object('accesos',(select count(*) from accesos where es_prueba),'actividades',(select count(*) from actividades where es_prueba),'evaluaciones',(select count(*) from evaluaciones where es_prueba),'impulsa',(select count(*) from impulsa where es_prueba),'descargas',(select count(*) from descargas where es_prueba))
 ) into resultado;
 return resultado;
end $$;
revoke all on function public.reporte_mensual_csd(date,boolean) from public,anon;
grant execute on function public.reporte_mensual_csd(date,boolean) to authenticated;
