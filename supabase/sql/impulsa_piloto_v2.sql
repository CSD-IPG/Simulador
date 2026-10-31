-- Registro inmutable por intento y etapa. Sin RUT ni credenciales del participante.
create table public.impulsa_eventos_v2 (
 attempt_id uuid not null,
 stage text not null check(stage in ('diagnostico','salida')),
 fecha timestamptz not null default now(),
 email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@(alumnos\.ipg\.cl|docentes\.ipg\.cl|ipg\.cl)$'),
 perfil text not null check(perfil in ('estudiante','docente','colaborador','equipo_academico')),
 carrera text not null check(length(carrera) between 1 and 160),
 capability_hash text not null,
 scores jsonb not null,
 answers jsonb not null,
 activities jsonb not null default '{}',
 primary key(attempt_id,stage)
);
alter table public.impulsa_eventos_v2 enable row level security;
revoke all on public.impulsa_eventos_v2 from public,anon,authenticated;
grant select,insert on public.impulsa_eventos_v2 to service_role;
create index on public.impulsa_eventos_v2(email,fecha);
-- El receptor es el único escritor. No hay API pública de lectura ni UPDATE.
create function public.recibir_impulsa_v2(p jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare prev public.impulsa_eventos_v2; diag public.impulsa_eventos_v2;
begin
 perform pg_advisory_xact_lock(hashtextextended(p->>'email',0));
 select * into prev from public.impulsa_eventos_v2 where attempt_id=(p->>'attempt_id')::uuid and stage=p->>'stage';
 if found then
  if prev.email=p->>'email' and prev.capability_hash=p->>'capability_hash' and prev.answers=p->'answers' and prev.perfil=p->>'perfil' and prev.carrera=p->>'carrera' then return true;end if;
  raise exception 'Intento existente: no se permite reemplazarlo';
 end if;
 if (select count(*) from public.impulsa_eventos_v2 where email=p->>'email' and fecha>now()-interval '1 hour')>=120 then raise exception 'Demasiados envíos para este correo; reintenta más tarde'; end if;
 if p->>'stage'='salida' then
  select * into diag from public.impulsa_eventos_v2 where attempt_id=(p->>'attempt_id')::uuid and stage='diagnostico';
  if not found or diag.email<>p->>'email' or diag.capability_hash<>p->>'capability_hash' or diag.perfil<>p->>'perfil' or diag.carrera<>p->>'carrera' then raise exception 'Diagnóstico previo no válido';end if;
 end if;
 insert into public.impulsa_eventos_v2(attempt_id,stage,email,perfil,carrera,capability_hash,scores,answers,activities)
 values((p->>'attempt_id')::uuid,p->>'stage',p->>'email',p->>'perfil',p->>'carrera',p->>'capability_hash',p->'scores',p->'answers',p->'activities');return true;
end $$;
revoke all on function public.recibir_impulsa_v2(jsonb) from public,anon,authenticated;
grant execute on function public.recibir_impulsa_v2(jsonb) to service_role;
create function public.reporte_impulsa_v2(p_desde timestamptz default null,p_hasta timestamptz default null)
returns table(attempt_id uuid,fecha timestamptz,email text,perfil text,carrera text,dimension text,diagnostico int,salida int,fecha_salida timestamptz,intento bigint,intentos bigint,actividades jsonb)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.es_usuario_escuela() then raise exception 'No autorizado' using errcode='42501';end if;
 return query with d as (
 select e.*,row_number() over(partition by e.email order by e.fecha,e.attempt_id) as num,count(*) over(partition by e.email) as total
 from public.impulsa_eventos_v2 e where e.stage='diagnostico')
 select d.attempt_id,d.fecha,d.email,d.perfil,d.carrera,v.dimension,(d.scores->>v.k)::int*10,(s.scores->>v.k)::int*10,s.fecha,d.num,d.total,coalesce(s.activities,d.activities)
 from d left join public.impulsa_eventos_v2 s on s.attempt_id=d.attempt_id and s.stage='salida'
 cross join (values ('m','Matemática'),('t','Tecnologías de la Información'),('l','Comprensión lectora')) v(k,dimension)
 where (p_desde is null or d.fecha>=p_desde) and (p_hasta is null or d.fecha<p_hasta)
 order by d.fecha desc,d.attempt_id,v.k;
end $$;
revoke all on function public.reporte_impulsa_v2(timestamptz,timestamptz) from public,anon;
grant execute on function public.reporte_impulsa_v2(timestamptz,timestamptz) to authenticated;
