-- T103: RLS checks for the artist_tos table.
-- Replace both UUIDs with existing authenticated users before running this
-- script in the Supabase SQL editor. Both users must be artists.
--
-- The transaction is rolled back at the end, so the test does not persist data.

begin;

create temp table t103_users (
  user_a uuid not null,
  user_b uuid not null
);

insert into t103_users (user_a, user_b)
values (
  'a2db0764-5b01-4608-abea-8cdada298bcd',
  '1e1d819f-1ee6-44b5-b538-23a20dd83bd8'
);

do $$
declare
  valid_artists integer;
begin
  select count(*)
  into valid_artists
  from public.profiles
  where id in (
    (select user_a from t103_users),
    (select user_b from t103_users)
  )
  and handle is not null;

  if valid_artists <> 2 then
    raise exception 'T103 requiere dos usuarios con perfil de artista existente';
  end if;
end;
$$;

create temp table t103_tos (
  artist_id uuid not null
);

-- user_a upserts a TOS and can read it.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_a::text from t103_users),
  true
);

insert into public.artist_tos (artist_id, content)
values (
  (select user_a from t103_users),
  'TOS inicial de T103'
)
on conflict (artist_id) do update
set content = excluded.content;

insert into t103_tos (artist_id)
select user_a
from t103_users;

do $$
declare
  visible_tos integer;
  tos_content text;
begin
  select count(*), max(content)
  into visible_tos, tos_content
  from public.artist_tos
  where artist_id = (select artist_id from t103_tos);

  if visible_tos <> 1 or tos_content <> 'TOS inicial de T103' then
    raise exception 'T103 fallo: user_a no puede leer su TOS';
  end if;
end;
$$;

-- user_b cannot read or update user_a's TOS.
select set_config(
  'request.jwt.claim.sub',
  (select user_b::text from t103_users),
  true
);

do $$
declare
  visible_tos integer;
begin
  select count(*)
  into visible_tos
  from public.artist_tos
  where artist_id = (select artist_id from t103_tos);

  if visible_tos <> 0 then
    raise exception 'T103 fallo: user_b puede leer el TOS de user_a';
  end if;
end;
$$;

do $$
declare
  affected_rows integer;
begin
  update public.artist_tos
  set content = 'TOS actualizado sin autorización'
  where artist_id = (select artist_id from t103_tos);
  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'T103 fallo: user_b actualiza el TOS de user_a';
  end if;
end;
$$;

-- anon has no table privileges and cannot perform any operation.
reset role;
set local role anon;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform 1 from public.artist_tos;
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'T103 fallo: anon puede leer artist_tos';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.artist_tos (artist_id, content)
    values (
      (select user_a from t103_users),
      'TOS anon insert'
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'T103 fallo: anon puede crear artist_tos';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.artist_tos
    set content = 'TOS anon update'
    where artist_id = (select artist_id from t103_tos);
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'T103 fallo: anon puede actualizar artist_tos';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    delete from public.artist_tos
    where artist_id = (select artist_id from t103_tos);
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'T103 fallo: anon puede eliminar artist_tos';
  end if;
end;
$$;

-- The content length check rejects values shorter than 10 characters.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_a::text from t103_users),
  true
);

do $$
declare
  rejected boolean := false;
  constraint_name text;
begin
  begin
    update public.artist_tos
    set content = 'corto'
    where artist_id = (select artist_id from t103_tos);
  exception
    when check_violation then
      rejected := true;
      get stacked diagnostics constraint_name = constraint_name;
  end;

  if not rejected or constraint_name <> 'artist_tos_content_len' then
    raise exception 'T103 fallo: se acepto contenido menor a 10 caracteres';
  end if;
end;
$$;

-- The content length check rejects values longer than 5000 characters.
do $$
declare
  rejected boolean := false;
  constraint_name text;
begin
  begin
    update public.artist_tos
    set content = repeat('x', 5001)
    where artist_id = (select artist_id from t103_tos);
  exception
    when check_violation then
      rejected := true;
      get stacked diagnostics constraint_name = constraint_name;
  end;

  if not rejected or constraint_name <> 'artist_tos_content_len' then
    raise exception 'T103 fallo: se acepto contenido mayor a 5000 caracteres';
  end if;
end;
$$;

rollback;
