-- T104: checks for get_artist_public_profile.
-- Replace both UUIDs with existing authenticated users before running this
-- script in the Supabase SQL editor. user_a must be an artist.
--
-- The transaction is rolled back at the end, so the test does not persist data.

begin;

create temp table t104_artist (
  artist_id uuid not null,
  handle text not null
);

insert into t104_artist (artist_id, handle)
select id, handle
from public.profiles
where id = 'a2db0764-5b01-4608-abea-8cdada298bcd'
  and handle is not null;

do $$
begin
  if not exists (select 1 from t104_artist) then
    raise exception 'T104 requiere que user_a tenga un perfil de artista';
  end if;
end;
$$;

-- Seed one active service, one paused service, and a TOS for the artist.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select artist_id::text from t104_artist),
  true
);

insert into public.services (
  artist_id,
  title,
  description,
  price_mxn,
  delivery_days,
  status
)
values (
  (select artist_id from t104_artist),
  'T104 servicio activo',
  'Visible en el perfil público',
  250,
  10,
  'active'
), (
  (select artist_id from t104_artist),
  'T104 servicio pausado',
  'No visible en el perfil público',
  300,
  14,
  'paused'
);

insert into public.artist_tos (artist_id, content)
values (
  (select artist_id from t104_artist),
  'TOS público de prueba T104'
)
on conflict (artist_id) do update
set content = excluded.content;

-- An authenticated user receives the public profile with active services and TOS.
do $$
declare
  profile jsonb;
  services jsonb;
begin
  select public.get_artist_public_profile(handle)
  into profile
  from t104_artist;

  if profile is null then
    raise exception 'T104 fallo: el perfil público válido devolvió null';
  end if;

  if profile->>'handle' <> (select handle from t104_artist)
    or profile->>'tos' <> 'TOS público de prueba T104' then
    raise exception 'T104 fallo: el perfil o TOS no coincide';
  end if;

  services := profile->'services';
  if jsonb_array_length(services) <> 1
    or not (services @> '[{"title": "T104 servicio activo"}]'::jsonb)
    or services @> '[{"title": "T104 servicio pausado"}]'::jsonb then
    raise exception 'T104 fallo: el perfil no filtra correctamente los servicios';
  end if;
end;
$$;

-- A nonexistent handle returns SQL null, exposed as data = null by supabase-js.
do $$
declare
  profile jsonb;
begin
  select public.get_artist_public_profile('t104-handle-inexistente')
  into profile;

  if profile is not null then
    raise exception 'T104 fallo: un handle inexistente no devolvio null';
  end if;
end;
$$;

-- The public profile contains only explicitly allowed fields.
do $$
declare
  profile jsonb;
  unexpected_keys text[];
begin
  select public.get_artist_public_profile(handle)
  into profile
  from t104_artist;

  select array_agg(key order by key)
  into unexpected_keys
  from jsonb_object_keys(profile) as key
  where key not in ('display_name', 'handle', 'services', 'tos');

  if unexpected_keys is not null
    or profile ? 'email'
    or profile ? 'privacy_accepted_at'
    or profile ? 'is_artist' then
    raise exception 'T104 fallo: el perfil público expone campos privados';
  end if;
end;
$$;

-- anon cannot execute the security-definer function.
reset role;
set local role anon;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.get_artist_public_profile(
      (select handle from t104_artist)
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if not rejected then
    raise exception 'T104 fallo: anon puede ejecutar el perfil público';
  end if;
end;
$$;

rollback;
