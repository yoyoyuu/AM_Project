-- T003: RLS checks for commissions and commission_references tables.
-- Replace the three UUIDs below with existing authenticated users before
-- running this script in the Supabase SQL editor.
--   user_client  — usuario que actúa como cliente (debe tener perfil de artista para poder
--                  crear un servicio de prueba)
--   user_artist  — usuario que actúa como artista (distinto de user_client)
--   user_stranger — usuario sin relación alguna con la comisión de prueba
--
-- The transaction is rolled back at the end, so the test does not persist data.

begin;

create temp table t003_users (
  user_client  uuid not null,
  user_artist  uuid not null,
  user_stranger uuid not null
);

insert into t003_users (user_client, user_artist, user_stranger)
values (
  'a2db0764-5b01-4608-abea-8cdada298bcd',
  '1e1d819f-1ee6-44b5-b538-23a20dd83bd8',
  'c9e8f1a2-3b4d-4e5f-6a7b-8c9d0e1f2a3b'
);

-- Validate that client and artist are different users
do $$
begin
  if (select user_client = user_artist from t003_users) then
    raise exception 'T003 requiere que user_client y user_artist sean distintos';
  end if;
  if (select user_client = user_stranger from t003_users) then
    raise exception 'T003 requiere que user_client y user_stranger sean distintos';
  end if;
  if (select user_artist = user_stranger from t003_users) then
    raise exception 'T003 requiere que user_artist y user_stranger sean distintos';
  end if;
end;
$$;

-- Setup: create a service owned by user_artist (requires artist profile with handle).
-- This insert runs as the postgres superuser to bypass RLS on services.
create temp table t003_service (id uuid not null);

with svc as (
  insert into public.services (artist_id, title, price_mxn, delivery_days)
  values (
    (select user_artist from t003_users),
    'T003 servicio prueba',
    500,
    14
  )
  returning id
)
insert into t003_service (id)
select id from svc;

-- ============================================================
-- Prueba 1: cliente puede insertar su propia comisión
-- Esperado: INSERT exitoso; la fila queda visible para user_client
-- ============================================================

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_client::text from t003_users),
  true
);

create temp table t003_commission (id uuid not null);

do $$
declare
  rejected boolean := false;
  error_message text;
begin
  begin
    with ins as (
      insert into public.commissions (
        client_id, artist_id, service_id,
        description, intended_use
      )
      values (
        (select user_client from t003_users),
        (select user_artist from t003_users),
        (select id from t003_service),
        'Descripción de prueba T003 con más de veinte caracteres',
        'personal'
      )
      returning id
    )
    insert into t003_commission (id) select id from ins;
  exception
    when others then
      rejected := true;
      get stacked diagnostics error_message = message_text;
  end;

  if rejected then
    raise exception 'T003 Prueba 1 FALLO: cliente no pudo insertar su propia comisión. Error: %', error_message;
  end if;
end;
$$;

-- Verificar que user_client puede leer la comisión que acaba de crear
do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.commissions
  where id = (select id from t003_commission);

  if visible <> 1 then
    raise exception 'T003 Prueba 1 FALLO: user_client no puede leer su propia comisión';
  end if;
end;
$$;

-- ============================================================
-- Prueba 2: cliente NO puede crear comisión usurpando client_id de otro
-- Esperado: error de RLS (new row violates row-level security policy)
-- ============================================================

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.commissions (
      client_id, artist_id, service_id,
      description, intended_use
    )
    values (
      (select user_stranger from t003_users),  -- client_id ≠ auth.uid()
      (select user_artist from t003_users),
      (select id from t003_service),
      'Intento de usurpación de identidad T003 con suficientes chars',
      'personal'
    );
  exception
    when others then
      rejected := true;
  end;

  if not rejected then
    raise exception 'T003 Prueba 2 FALLO: user_client insertó comisión con client_id ajeno';
  end if;
end;
$$;

-- ============================================================
-- Prueba 3: tercero NO puede ver comisiones ajenas
-- Esperado: SELECT devuelve 0 filas (RLS filtra silenciosamente)
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_stranger::text from t003_users),
  true
);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.commissions
  where id = (select id from t003_commission);

  if visible <> 0 then
    raise exception 'T003 Prueba 3 FALLO: user_stranger puede leer comisiones ajenas';
  end if;
end;
$$;

-- ============================================================
-- Prueba 4: artista SÍ puede leer las comisiones que le pertenecen
-- Esperado: SELECT devuelve 1 fila
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_artist::text from t003_users),
  true
);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.commissions
  where id = (select id from t003_commission);

  if visible <> 1 then
    raise exception 'T003 Prueba 4 FALLO: user_artist no puede leer la comisión que le pertenece';
  end if;
end;
$$;

-- ============================================================
-- Prueba 5: CHECK constraint impide client_id = artist_id
-- Esperado: error de CHECK constraint (client_ne_artist)
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_client::text from t003_users),
  true
);

do $$
declare
  rejected boolean := false;
  error_message text;
begin
  begin
    insert into public.commissions (
      client_id, artist_id, service_id,
      description, intended_use
    )
    values (
      (select user_client from t003_users),
      (select user_client from t003_users),  -- artist_id = client_id → viola constraint
      (select id from t003_service),
      'Intento de auto-solicitud T003 con suficientes caracteres aquí',
      'personal'
    );
  exception
    when check_violation then
      rejected := true;
    when others then
      rejected := true;  -- RLS también puede rechazarlo primero
      get stacked diagnostics error_message = message_text;
  end;

  if not rejected then
    raise exception 'T003 Prueba 5 FALLO: se permitió insertar comisión con client_id = artist_id';
  end if;
end;
$$;

rollback;
