-- Segunda migración del seguimiento. La dirección queda fijada a una sola identidad verificada.
create table seguimiento_escuela.direccion (
 unica boolean primary key default true check (unica),
 user_id uuid not null unique references auth.users(id)
);
do $bootstrap$
declare candidatas uuid[];
begin
 select array_agg(u.id) into candidatas from auth.users u join public.perfiles_csd p on p.user_id=u.id
 where p.rol='escuela' and p.activo and u.email_confirmed_at is not null;
 if coalesce(cardinality(candidatas),0)<>1 then
  raise exception 'La asignación inicial requiere una única cuenta de Dirección verificada';
 end if;
 insert into seguimiento_escuela.direccion(user_id) values(candidatas[1]);
end;
$bootstrap$;
alter table seguimiento_escuela.equipo
 add column user_id uuid unique references auth.users(id) on delete set null,
 add column activacion_hash bytea unique,
 add column vence timestamptz;
-- Conservar la clave de quienes ya tenían una cuenta y estaban habilitados.
update seguimiento_escuela.equipo e set user_id=u.id from auth.users u
 where e.email=lower(u.email) and u.email_confirmed_at is not null;
revoke all on seguimiento_escuela.direccion from public,anon,authenticated;
alter table seguimiento_escuela.direccion enable row level security;
alter table seguimiento_escuela.equipo enable row level security;
alter table seguimiento_escuela.cierres enable row level security;
alter table seguimiento_escuela.fichas enable row level security;
alter table seguimiento_escuela.gestiones enable row level security;

-- El enlace permite comprobar el tipo de activación. No devuelve identidades ni información académica.
create function public.preparar_acceso_seguimiento(correo text,codigo text)
returns text language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from auth.users u where lower(u.email)=e.email)
  then 'existente' else 'nueva' end
 from seguimiento_escuela.equipo e
 where e.email=lower(trim(correo)) and e.activo and e.user_id is null and e.vence>now()
 and length(codigo)=64 and e.activacion_hash=sha256(convert_to(codigo,'UTF8'));
$$;
revoke all on function public.preparar_acceso_seguimiento(text,text) from public;
grant execute on function public.preparar_acceso_seguimiento(text,text) to anon,authenticated;
create or replace function public.seguimiento_academico(accion text, datos jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 correo text; direccion boolean; rol text; p text:=datos->>'periodo'; r text:=datos->>'rut';
 destino text:=lower(trim(datos->>'email')); ver int; resp text; entrada jsonb; salida jsonb; eid uuid;
begin
 select lower(email) into correo from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if correo is null then raise exception 'Se requiere una cuenta verificada' using errcode='42501'; end if;
 direccion:=coalesce(public.es_usuario_escuela(),false) and exists
  (select 1 from seguimiento_escuela.direccion where user_id=auth.uid());
 if accion='vincular' then
  -- Una segunda petición, después de una respuesta perdida, confirma la misma identidad.
  if exists(select 1 from seguimiento_escuela.equipo where email=correo and user_id=auth.uid() and activo) then return 'true'; end if;
  update seguimiento_escuela.equipo set user_id=auth.uid(), activacion_hash=null, vence=null
   where email=correo and activo and user_id is null and vence>now() and length(datos->>'codigo')=64
    and activacion_hash=sha256(convert_to(datos->>'codigo','UTF8'));
  if not found then raise exception 'El enlace de activación no es válido o ya venció' using errcode='42501'; end if;
  return 'true';
 end if;
 select e.rol into rol from seguimiento_escuela.equipo e where e.email=correo and e.user_id=auth.uid() and activo;
 if not direccion and rol is null then raise exception 'La cuenta no tiene acceso al seguimiento' using errcode='42501'; end if;
 if not direccion and accion not in ('inicio','leer','intervenir') then
  raise exception 'Acción reservada a la Dirección de Escuela' using errcode='42501';
 end if;
 if accion='activacion' and direccion then
  entrada:=to_jsonb(replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''));
  update seguimiento_escuela.equipo set activacion_hash=sha256(convert_to(entrada#>>'{}','UTF8')),vence=now()+interval '48 hours'
   where email=destino and activo and user_id is null;
  if not found then raise exception 'El integrante debe estar habilitado y pendiente de activación'; end if;
  return jsonb_build_object('codigo',entrada,'vence',now()+interval '48 hours');
 end if;
 if accion='inicio' then
  return jsonb_build_object('email',correo,'role',case when direccion then 'Dirección' else rol end,
   'periods',coalesce((select jsonb_agg(jsonb_build_object('period',c.periodo,'version',c.version,'updated',c.actualizado) order by c.periodo desc)
    from seguimiento_escuela.cierres c where direccion or exists(select 1 from seguimiento_escuela.fichas f where f.periodo=c.periodo and f.responsable=correo)),'[]'::jsonb),
   'members',case when direccion then coalesce((select jsonb_agg(jsonb_build_object('email',email,'role',e.rol,'active',activo,'linked',e.user_id is not null,'expires',e.vence) order by email) from seguimiento_escuela.equipo e),'[]'::jsonb) else '[]'::jsonb end);
 end if;
 if accion='equipo' and direccion then
  if destino is null or length(destino)>254 or destino !~ '^[^ @]+@[^ @]+\.[^ @]+$' or datos->>'role' is null or datos->>'role' not in ('Jefatura','Consejería') or jsonb_typeof(datos->'active') is distinct from 'boolean' then raise exception 'Revise el correo y el perfil'; end if;
  insert into seguimiento_escuela.equipo(email,rol,activo) values(destino,datos->>'role',(datos->>'active')::boolean)
   on conflict(email) do update set rol=excluded.rol,activo=excluded.activo,
   activacion_hash=case when excluded.activo then equipo.activacion_hash end,
   vence=case when excluded.activo then equipo.vence end;
  return 'true';
 end if;
 if p is null or p !~ '^(19|20)[0-9]{2}-(0[1-9]|10)$' then raise exception 'Período inválido'; end if;
 if accion='importar' and direccion then
  perform pg_advisory_xact_lock(hashtext('seguimiento_escuela'),hashtext(p));
  select version into ver from seguimiento_escuela.cierres where periodo=p;
  if datos->>'expected' is null or coalesce(ver,0)<>(datos->>'expected')::int then raise exception 'El cierre cambió. Actualice y vuelva a validar el archivo.'; end if;
  entrada:=datos->'rows';
  if jsonb_typeof(entrada) is distinct from 'array' or coalesce(length(trim(datos->>'filename')),0) not between 1 and 255 then raise exception 'Archivo inválido'; end if;
  if jsonb_array_length(entrada) not between 1 and 25000 then raise exception 'El cierre debe incluir entre 1 y 25.000 inscripciones'; end if;
  if exists(select 1 from jsonb_array_elements(entrada) a where coalesce(length(a->>'rut'),0) not between 2 and 20 or coalesce(length(a->>'name'),0)=0 or coalesce(length(a->>'careerCode'),0)=0 or coalesce(length(a->>'subjectCode'),0)=0 or coalesce(length(a->>'studentCode'),0)=0 or jsonb_typeof(a->'grade') is distinct from 'number' or not ((a->>'grade')::numeric in (0,1) or (a->>'grade')::numeric between 1.1 and 7)) then raise exception 'Hay datos de inscripción incompletos o notas inválidas'; end if;
  if exists(select 1 from jsonb_array_elements(entrada) a group by a->>'studentCode',a->>'careerCode',a->>'subjectCode',a->>'section' having count(*)>1) then raise exception 'Hay inscripciones duplicadas'; end if;
  insert into seguimiento_escuela.cierres values(p,coalesce(ver,0)+1,datos->>'filename',entrada,now())
   on conflict(periodo) do update set version=excluded.version,archivo=excluded.archivo,filas=excluded.filas,actualizado=excluded.actualizado;
  update seguimiento_escuela.fichas set vigente=false where periodo=p and vigente;
  insert into seguimiento_escuela.fichas(periodo,rut,nombre,carrera,vigente)
    select distinct on (a->>'rut') p,a->>'rut',a->>'name',a->>'career',true from jsonb_array_elements(entrada) a where (a->>'grade')::numeric<4 order by a->>'rut',a->>'career'
   on conflict(periodo,rut) do update set vigente=true,nombre=excluded.nombre,carrera=excluded.carrera;
  return jsonb_build_object('version',coalesce(ver,0)+1);
 end if;
 if accion in ('leer','reporte') then
  select jsonb_build_object('filename',case when direccion then c.archivo else '' end,'version',c.version,
   'rows',case when direccion then c.filas else coalesce((select jsonb_agg(jsonb_build_object('rut',f.rut,'name',a->>'name','career',a->>'career','careerCode',a->>'careerCode',
    'subject',a->>'subject','subjectCode',a->>'subjectCode','section',a->>'section','grade',a->'grade','review',a->'review')) from jsonb_array_elements(c.filas) a join seguimiento_escuela.fichas f on f.periodo=p and f.rut=a->>'rut' where f.responsable=correo and f.vigente and (a->>'grade')::numeric<4),'[]'::jsonb) end,
   'tracking',coalesce((select jsonb_object_agg(f.rut,jsonb_build_object('name',f.nombre,'career',f.carrera,'active',f.vigente,'assignee',f.responsable,'events',
    coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'author',g.autor,'created_at',g.fecha,'channel',g.canal,'outcome',g.resultado,'note',g.nota,'csd',g.csd,'referral',g.derivacion,'next_date',g.proxima) order by g.fecha desc,g.id) from seguimiento_escuela.gestiones g where g.periodo=p and g.rut=f.rut),'[]'::jsonb))) from seguimiento_escuela.fichas f where f.periodo=p and (direccion or f.responsable=correo)),'{}'::jsonb))
   into salida from seguimiento_escuela.cierres c where c.periodo=p and (direccion or exists(select 1 from seguimiento_escuela.fichas f where f.periodo=p and f.responsable=correo));
  if salida is null then raise exception 'Cierre no disponible' using errcode='42501'; end if;
  return salida;
 end if;
 if accion in ('asignar','intervenir') then
  select responsable into resp from seguimiento_escuela.fichas where periodo=p and rut=r for update;
  if not found or (not direccion and resp is distinct from correo) then raise exception 'Ficha no disponible' using errcode='42501'; end if;
  if accion='asignar' and direccion then
   if resp is distinct from nullif(datos->>'prev','') then raise exception 'La asignación cambió. Actualice la ficha.'; end if;
   if nullif(destino,'') is not null and not exists(select 1 from seguimiento_escuela.equipo where email=destino and activo) then raise exception 'Responsable no habilitado'; end if;
   update seguimiento_escuela.fichas set responsable=nullif(destino,'') where periodo=p and rut=r;
   return 'true';
  elsif accion='intervenir' then
   if coalesce(datos->>'channel','') not in ('Correo institucional','Llamada','Reunión','Aula virtual','Otro') or coalesce(datos->>'outcome','') not in ('Intento sin respuesta','Contacto efectivo','Derivado','Cerrado') or coalesce(length(trim(datos->>'note')),0) not between 1 and 4000 or coalesce(length(datos->>'referral'),0)>300 or coalesce(length(datos->>'csd'),0)>300 or (datos->>'outcome'='Derivado' and coalesce(length(trim(datos->>'referral')),0)=0) then raise exception 'Complete canal, resultado, observación y, si corresponde, área de derivación'; end if;
   eid:=(datos->>'id')::uuid;
   insert into seguimiento_escuela.gestiones(id,periodo,rut,autor,canal,resultado,nota,csd,derivacion,proxima)
    values(eid,p,r,correo,datos->>'channel',datos->>'outcome',trim(datos->>'note'),coalesce(datos->>'csd',''),coalesce(datos->>'referral',''),nullif(datos->>'next_date','')::date) on conflict(id) do nothing;
   if not exists(select 1 from seguimiento_escuela.gestiones where id=eid and periodo=p and rut=r and autor=correo) then raise exception 'Identificador de intervención inválido'; end if;
   return 'true';
  end if;
 end if;
 raise exception 'Acción no autorizada' using errcode='42501';
end;
$$;
revoke all on function public.seguimiento_academico(text,jsonb) from public,anon,authenticated;
grant execute on function public.seguimiento_academico(text,jsonb) to authenticated;
notify pgrst,'reload schema';
