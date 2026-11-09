create table public.services (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid not null references public.profiles (id) on delete cascade,
  title         text not null,
  description   text,
  price_mxn     integer not null,
  delivery_days integer not null,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint services_title_len
    check (char_length(title) between 3 and 80),
  constraint services_description_len
    check (description is null or char_length(description) <= 1000),
  constraint services_price_positive
    check (price_mxn > 0),
  constraint services_delivery_days_range
    check (delivery_days between 1 and 365),
  constraint services_status_valid
    check (status in ('active', 'paused'))
);

create index services_artist_id_idx
  on public.services (artist_id);

create index services_artist_status_idx
  on public.services (artist_id, status);

create index services_created_at_idx
  on public.services (artist_id, created_at desc);

create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create function public.check_services_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.services
  where artist_id = new.artist_id;

  if v_count >= 20 then
    raise exception 'services_limit_reached';
  end if;

  return new;
end;
$$;

create trigger services_enforce_limit
before insert on public.services
for each row execute function public.check_services_limit();

create function public.check_artist_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.artist_id
      and handle is not null
  ) then
    raise exception 'not_an_artist';
  end if;

  return new;
end;
$$;

create trigger services_require_artist
before insert on public.services
for each row execute function public.check_artist_role();

create table public.artist_tos (
  artist_id  uuid primary key references public.profiles (id) on delete cascade,
  content    text,
  updated_at timestamptz not null default now(),

  constraint artist_tos_content_len
    check (content is null or char_length(content) between 10 and 5000)
);

create trigger artist_tos_set_updated_at
before update on public.artist_tos
for each row execute function public.set_updated_at();

create function public.get_artist_public_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile  record;
  v_services jsonb;
  v_tos      text;
begin
  select id, display_name, handle
  into v_profile
  from public.profiles
  where handle = p_handle;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',            s.id,
      'title',         s.title,
      'description',   s.description,
      'price_mxn',     s.price_mxn,
      'delivery_days', s.delivery_days,
      'created_at',    s.created_at
    ) order by s.created_at desc
  ), '[]'::jsonb)
  into v_services
  from public.services s
  where s.artist_id = v_profile.id
    and s.status = 'active';

  select content
  into v_tos
  from public.artist_tos
  where artist_id = v_profile.id;

  return jsonb_build_object(
    'display_name', v_profile.display_name,
    'handle',       v_profile.handle,
    'services',     v_services,
    'tos',          v_tos
  );
end;
$$;

revoke execute on function public.get_artist_public_profile(text)
from public, anon;

grant execute on function public.get_artist_public_profile(text)
to authenticated;

alter table public.services enable row level security;

create policy "artista lee sus servicios"
on public.services
for select
to authenticated
using (artist_id = (select auth.uid()));

create policy "artista crea servicios"
on public.services
for insert
to authenticated
with check (artist_id = (select auth.uid()));

create policy "artista edita sus servicios"
on public.services
for update
to authenticated
using (artist_id = (select auth.uid()))
with check (artist_id = (select auth.uid()));

create policy "artista elimina sus servicios"
on public.services
for delete
to authenticated
using (artist_id = (select auth.uid()));

alter table public.artist_tos enable row level security;

create policy "artista lee su tos"
on public.artist_tos
for select
to authenticated
using (artist_id = (select auth.uid()));

create policy "artista crea su tos"
on public.artist_tos
for insert
to authenticated
with check (artist_id = (select auth.uid()));

create policy "artista edita su tos"
on public.artist_tos
for update
to authenticated
using (artist_id = (select auth.uid()))
with check (artist_id = (select auth.uid()));

revoke all on public.services from anon, authenticated;
revoke all on public.artist_tos from anon, authenticated;

grant select, insert, update, delete
on public.services
to authenticated;

grant select, insert, update
on public.artist_tos
to authenticated;
