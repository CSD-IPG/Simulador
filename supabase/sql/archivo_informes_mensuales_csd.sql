create table public.csd_informes_mensuales (
 id uuid primary key,
 mes date not null,
 generado_en timestamptz not null,
 creado_por uuid not null,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 storage_prefix text not null unique,
 excluye_pruebas boolean not null,
 corte_parcial boolean not null,
 resumen jsonb not null,
 creado_en timestamptz not null default now()
);
alter table public.csd_informes_mensuales enable row level security;
revoke all on public.csd_informes_mensuales from public,anon,authenticated;
grant select,insert on public.csd_informes_mensuales to service_role;
create index on public.csd_informes_mensuales(mes desc,generado_en desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('csd-informes-mensuales','csd-informes-mensuales',false,52428800,array['application/pdf','text/csv','application/json']);
create policy informes_mensuales_direccion_lectura on storage.objects for select to authenticated
using(bucket_id='csd-informes-mensuales' and (select public.es_usuario_escuela()));
create function public.listar_informes_mensuales_csd()
returns setof public.csd_informes_mensuales language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.es_usuario_escuela() then raise exception 'No autorizado' using errcode='42501';end if;
 return query select * from public.csd_informes_mensuales order by mes desc,generado_en desc;
end $$;
revoke all on function public.listar_informes_mensuales_csd() from public,anon;
grant execute on function public.listar_informes_mensuales_csd() to authenticated;
