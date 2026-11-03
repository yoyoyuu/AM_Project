create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  handle text,
  privacy_accepted_at timestamptz not null,
  privacy_notice_version text not null,
  profile_complete boolean generated always as (display_name is not null) stored,
  is_artist boolean generated always as (handle is not null) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_len
    check (display_name is null or char_length(display_name) between 2 and 50),
  constraint profiles_handle_format
    check (handle is null or (
      char_length(handle) between 3 and 30
      and handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$')),
  constraint profiles_handle_reserved
    check (handle is null or handle <> all (array[
      'admin', 'api', 'app', 'auth', 'login', 'logout', 'register', 'registro',
      'signup', 'signin', 'verify', 'reset', 'forgot', 'profile', 'perfil',
      'settings', 'ajustes', 'support', 'soporte', 'help', 'ayuda', 'koma',
      'www', 'mail', 'root', 'about', 'terms', 'privacy', 'privacidad',
      'comisiones', 'catalogo', 'artista', 'artistas', 'cliente', 'clientes'
    ]))
);

create unique index profiles_handle_key on public.profiles (handle);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create function public.prevent_handle_unset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.handle is not null and new.handle is null then
    raise exception 'artist_profile_cannot_be_unset';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_handle_unset
before update on public.profiles
for each row execute function public.prevent_handle_unset();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'privacy_accepted', 'false') <> 'true' then
    raise exception 'privacy_not_accepted';
  end if;

  insert into public.profiles (
    id,
    privacy_accepted_at,
    privacy_notice_version
  )
  values (
    new.id,
    now(),
    coalesce(new.raw_user_meta_data ->> 'privacy_notice_version', 'v1')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.is_handle_available(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.profiles
    where handle = p_handle
  );
$$;

revoke execute on function public.is_handle_available(text) from public, anon;
grant execute on function public.is_handle_available(text) to authenticated;

alter table public.profiles enable row level security;

create policy "usuario lee su perfil"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "usuario edita su perfil"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, handle) on public.profiles to authenticated;
