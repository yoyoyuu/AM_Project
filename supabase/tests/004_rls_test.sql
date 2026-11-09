-- T044: RLS checks for spec 004 — Gestión de comisión.
-- Replace the three UUIDs below with existing authenticated users before
-- running this script in the Supabase SQL editor.
--   user_client   — usuario que actúa como cliente (creó la comisión)
--   user_artist   — usuario que actúa como artista (propietario de la comisión)
--   user_stranger — usuario sin relación con la comisión (tercero / artista ajeno)
--
-- The transaction is rolled back at the end, so test data is not persisted.

begin;

create temp table t004_users (
  user_client   uuid not null,
  user_artist   uuid not null,
  user_stranger uuid not null
);

insert into t004_users (user_client, user_artist, user_stranger)
values (
  'a2db0764-5b01-4608-abea-8cdada298bcd',
  '1e1d819f-1ee6-44b5-b538-23a20dd83bd8',
  'c9e8f1a2-3b4d-4e5f-6a7b-8c9d0e1f2a3b'
);

-- Validar que los tres usuarios son distintos
do $$
begin
  if (select user_client = user_artist from t004_users) then
    raise exception 'T044 requiere que user_client y user_artist sean distintos';
  end if;
  if (select user_client = user_stranger from t004_users) then
    raise exception 'T044 requiere que user_client y user_stranger sean distintos';
  end if;
  if (select user_artist = user_stranger from t004_users) then
    raise exception 'T044 requiere que user_artist y user_stranger sean distintos';
  end if;
end;
$$;

-- Setup: crear servicio para user_artist (bypass RLS, corre como postgres)
create temp table t004_service (id uuid not null);

with svc as (
  insert into public.services (artist_id, title, price_mxn, delivery_days)
  values (
    (select user_artist from t004_users),
    'T044 servicio prueba',
    500,
    14
  )
  returning id
)
insert into t004_service (id) select id from svc;

-- Setup: crear dos comisiones en estado PENDIENTE
--   commission_a — para pruebas de lectura y cambio de estado (aceptar)
--   commission_b — para prueba de rechazo con motivo
create temp table t004_commissions (commission_a uuid, commission_b uuid);

with ins as (
  insert into public.commissions (client_id, artist_id, service_id, description, intended_use)
  values
    (
      (select user_client from t004_users),
      (select user_artist from t004_users),
      (select id from t004_service),
      'Comisión A de prueba T044 — más de veinte caracteres aquí',
      'personal'
    ),
    (
      (select user_client from t004_users),
      (select user_artist from t004_users),
      (select id from t004_service),
      'Comisión B de prueba T044 — más de veinte caracteres aquí',
      'personal'
    )
  returning id
)
insert into t004_commissions (commission_a, commission_b)
select min(id), max(id) from ins;

-- ============================================================
-- Prueba 1: artista puede leer sus propias comisiones pendientes
-- Esperado: SELECT devuelve al menos 1 fila propia con status PENDIENTE
-- ============================================================

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_artist::text from t004_users),
  true
);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.commissions
  where artist_id = (select user_artist from t004_users)
    and status = 'PENDIENTE';

  if visible < 1 then
    raise exception 'T044 Prueba 1 FALLO: artista no puede leer sus comisiones pendientes';
  end if;
end;
$$;

-- ============================================================
-- Prueba 2: artista NO puede leer comisiones de otro artista
-- Esperado: SELECT devuelve 0 filas (RLS filtra silenciosamente)
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_stranger::text from t004_users),
  true
);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.commissions
  where artist_id = (select user_artist from t004_users);

  if visible <> 0 then
    raise exception 'T044 Prueba 2 FALLO: user_stranger puede leer comisiones ajenas (% filas visibles)', visible;
  end if;
end;
$$;

-- ============================================================
-- Prueba 3: artista puede actualizar status de su propia comisión
-- Esperado: UPDATE afecta 1 fila (PENDIENTE → EN_PROGRESO / SKETCH)
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_artist::text from t004_users),
  true
);

do $$
declare
  updated_count integer;
begin
  update public.commissions
  set status = 'EN_PROGRESO', current_stage = 'SKETCH'
  where id = (select commission_a from t004_commissions)
    and artist_id = (select user_artist from t004_users);

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception 'T044 Prueba 3 FALLO: artista no pudo actualizar status de su propia comisión (% filas)', updated_count;
  end if;
end;
$$;

-- ============================================================
-- Prueba 4: artista NO puede actualizar comisión ajena
-- Esperado: UPDATE afecta 0 filas (RLS filtra por artist_id)
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_stranger::text from t004_users),
  true
);

do $$
declare
  updated_count integer;
begin
  update public.commissions
  set status = 'EN_PROGRESO'
  where id = (select commission_a from t004_commissions);

  get diagnostics updated_count = row_count;

  if updated_count <> 0 then
    raise exception 'T044 Prueba 4 FALLO: user_stranger pudo actualizar comisión ajena (% filas)', updated_count;
  end if;
end;
$$;

-- ============================================================
-- Prueba 5: cliente NO puede actualizar status de la comisión
-- Esperado: UPDATE afecta 0 filas (RLS: USING exige auth.uid() = artist_id)
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_client::text from t004_users),
  true
);

do $$
declare
  updated_count integer;
begin
  update public.commissions
  set status = 'COMPLETADA'
  where id = (select commission_a from t004_commissions);

  get diagnostics updated_count = row_count;

  if updated_count <> 0 then
    raise exception 'T044 Prueba 5 FALLO: user_client pudo actualizar status (% filas)', updated_count;
  end if;
end;
$$;

-- ============================================================
-- Prueba 6: tercero NO puede actualizar ninguna comisión
-- Esperado: UPDATE afecta 0 filas
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_stranger::text from t004_users),
  true
);

do $$
declare
  updated_count integer;
begin
  update public.commissions
  set status = 'RECHAZADA'
  where id = (select commission_a from t004_commissions);

  get diagnostics updated_count = row_count;

  if updated_count <> 0 then
    raise exception 'T044 Prueba 6 FALLO: user_stranger pudo actualizar una comisión (% filas)', updated_count;
  end if;
end;
$$;

-- ============================================================
-- Prueba 7: artista puede rechazar comisión con motivo válido
-- Esperado: UPDATE afecta 1 fila; rejection_reason guardado
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_artist::text from t004_users),
  true
);

do $$
declare
  updated_count integer;
begin
  update public.commissions
  set status = 'RECHAZADA', rejection_reason = 'No tengo capacidad esta semana'
  where id = (select commission_b from t004_commissions)
    and artist_id = (select user_artist from t004_users)
    and status = 'PENDIENTE';

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception 'T044 Prueba 7 FALLO: artista no pudo rechazar comisión con motivo válido (% filas)', updated_count;
  end if;
end;
$$;

-- ============================================================
-- Prueba 8: rejection_reason > 500 caracteres falla por CHECK constraint
-- Esperado: error de violación de CHECK (char_length(rejection_reason) <= 500)
-- ============================================================

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.commissions
    set rejection_reason = repeat('x', 501)
    where id = (select commission_a from t004_commissions)
      and artist_id = (select user_artist from t004_users);
  exception
    when check_violation then
      rejected := true;
    when others then
      rejected := true;
  end;

  if not rejected then
    raise exception 'T044 Prueba 8 FALLO: se permitió guardar rejection_reason de 501 caracteres';
  end if;
end;
$$;

rollback;
