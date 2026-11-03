-- T102: RLS checks for the services table.
-- Replace both UUIDs with existing authenticated users before running this
-- script in the Supabase SQL editor. user_a and user_b must be artists.
--
-- The transaction is rolled back at the end, so the test does not persist data.

begin;

create temp table t102_users (
  user_a uuid not null,
  user_b uuid not null,
  user_without_handle uuid
);

insert into t102_users (user_a, user_b, user_without_handle)
values (
  'a2db0764-5b01-4608-abea-8cdada298bcd',
  '1e1d819f-1ee6-44b5-b538-23a20dd83bd8',
  (
    select id
    from public.profiles
    where handle is null
    limit 1
  )
);

do $$
declare
  valid_artists integer;
begin
  select count(*)
  into valid_artists
  from public.profiles
  where id in (
    (select user_a from t102_users),
    (select user_b from t102_users)
  )
  and handle is not null;

  if valid_artists <> 2 then
    raise exception 'T102 requiere dos usuarios con perfil de artista existente';
  end if;

  if (select user_without_handle from t102_users) is null then
    raise exception 'T102 requiere un usuario existente sin handle';
  end if;
end;
$$;

-- user_a creates a service and can read it.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_a::text from t102_users),
  true
);

create temp table t102_service (
  id uuid not null
);

with inserted_service as (
  insert into public.services (
    artist_id,
    title,
    description,
    price_mxn,
    delivery_days
  )
  values (
    (select user_a from t102_users),
    'T102 servicio base',
    'Servicio creado por la prueba T102',
    100,
    7
  )
  returning id
)
insert into t102_service (id)
select id
from inserted_service;

do $$
declare
  visible_services integer;
begin
  select count(*)
  into visible_services
  from public.services
  where id = (select id from t102_service);

  if visible_services <> 1 then
    raise exception 'T102 fallo: user_a no puede leer su servicio';
  end if;
end;
$$;

-- user_b cannot read user_a's service.
select set_config(
  'request.jwt.claim.sub',
  (select user_b::text from t102_users),
  true
);

do $$
declare
  visible_services integer;
begin
  select count(*)
  into visible_services
  from public.services
  where id = (select id from t102_service);

  if visible_services <> 0 then
    raise exception 'T102 fallo: user_b puede leer el servicio de user_a';
  end if;
end;
$$;

-- RLS filters user_b's update and delete to zero affected rows.
do $$
declare
  affected_rows integer;
begin
  update public.services
  set title = 'T102 actualización no autorizada'
  where id = (select id from t102_service);
  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'T102 fallo: user_b actualiza el servicio de user_a';
  end if;
end;
$$;

do $$
declare
  affected_rows integer;
begin
  delete from public.services
  where id = (select id from t102_service);
  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'T102 fallo: user_b elimina el servicio de user_a';
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
    perform 1 from public.services;
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'T102 fallo: anon puede leer services';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.services (artist_id, title, price_mxn, delivery_days)
    values (
      (select user_a from t102_users),
      'T102 anon insert',
      100,
      7
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'T102 fallo: anon puede crear services';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.services
    set title = 'T102 anon update'
    where id = (select id from t102_service);
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'T102 fallo: anon puede actualizar services';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    delete from public.services
    where id = (select id from t102_service);
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'T102 fallo: anon puede eliminar services';
  end if;
end;
$$;

-- The 21st service is rejected by check_services_limit.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_a::text from t102_users),
  true
);

insert into public.services (artist_id, title, price_mxn, delivery_days)
select
  (select user_a from t102_users),
  'T102 servicio ' || series,
  100,
  7
from generate_series(1, 19) as series;

do $$
declare
  rejected boolean := false;
  error_message text;
begin
  begin
    insert into public.services (artist_id, title, price_mxn, delivery_days)
    values (
      (select user_a from t102_users),
      'T102 servicio 21',
      100,
      7
    );
  exception
    when others then
      rejected := true;
      get stacked diagnostics error_message = message_text;
  end;

  if not rejected or error_message <> 'services_limit_reached' then
    raise exception 'T102 fallo: el servicio 21 no fue rechazado';
  end if;
end;
$$;

-- A user without a handle cannot create a service.
select set_config(
  'request.jwt.claim.sub',
  (select user_without_handle::text from t102_users),
  true
);

do $$
declare
  rejected boolean := false;
  error_message text;
begin
  begin
    insert into public.services (artist_id, title, price_mxn, delivery_days)
    values (
      (select user_without_handle from t102_users),
      'T102 no artista',
      100,
      7
    );
  exception
    when others then
      rejected := true;
      get stacked diagnostics error_message = message_text;
  end;

  if not rejected or error_message <> 'not_an_artist' then
    raise exception 'T102 fallo: un usuario sin handle creo un servicio';
  end if;
end;
$$;

-- TODO: spec 004 — add an active commission and assert that its FK
-- prevents deleting the referenced service with error code 23503.

rollback;
