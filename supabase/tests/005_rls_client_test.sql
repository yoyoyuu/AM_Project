-- T005: RLS checks for spec 005 — Seguimiento de comisiones del cliente.
-- Replace the three UUIDs below with existing authenticated users before
-- running this script in the Supabase SQL editor.
--   user_client   — usuario que actúa como cliente (creó las comisiones)
--   user_artist   — usuario que actúa como artista (propietario del servicio)
--   user_stranger — usuario sin relación con las comisiones (tercero)
--
-- The transaction is rolled back at the end, so test data is not persisted.

begin;

create temp table t005_users (
  user_client   uuid not null,
  user_artist   uuid not null,
  user_stranger uuid not null
);

insert into t005_users (user_client, user_artist, user_stranger)
values (
  'a2db0764-5b01-4608-abea-8cdada298bcd',
  '1e1d819f-1ee6-44b5-b538-23a20dd83bd8',
  'c9e8f1a2-3b4d-4e5f-6a7b-8c9d0e1f2a3b'
);

-- Validar que los tres usuarios son distintos
do $$
begin
  if (select user_client = user_artist from t005_users) then
    raise exception 'T005 requiere que user_client y user_artist sean distintos';
  end if;
  if (select user_client = user_stranger from t005_users) then
    raise exception 'T005 requiere que user_client y user_stranger sean distintos';
  end if;
  if (select user_artist = user_stranger from t005_users) then
    raise exception 'T005 requiere que user_artist y user_stranger sean distintos';
  end if;
end;
$$;

-- Setup: crear servicio para user_artist (bypass RLS, corre como postgres)
create temp table t005_service (id uuid not null);

with svc as (
  insert into public.services (artist_id, title, price_mxn, delivery_days)
  values (
    (select user_artist from t005_users),
    'T005 servicio prueba',
    500,
    14
  )
  returning id
)
insert into t005_service (id) select id from svc;

-- Setup: crear dos comisiones
--   commission_a — estado PENDIENTE (para pruebas de lectura)
--   commission_b — estado RECHAZADA con rejection_reason (para prueba 5)
create temp table t005_commissions (commission_a uuid, commission_b uuid);

with ins as (
  insert into public.commissions (client_id, artist_id, service_id, description, intended_use)
  values
    (
      (select user_client from t005_users),
      (select user_artist from t005_users),
      (select id from t005_service),
      'Comisión A de prueba T005 — más de veinte caracteres aquí',
      'personal'
    ),
    (
      (select user_client from t005_users),
      (select user_artist from t005_users),
      (select id from t005_service),
      'Comisión B de prueba T005 — más de veinte caracteres aquí',
      'personal'
    )
  returning id
)
insert into t005_commissions (commission_a, commission_b)
select min(id), max(id) from ins;

-- Poner commission_b en estado RECHAZADA con motivo
update public.commissions
set status = 'RECHAZADA', rejection_reason = 'No tengo capacidad esta semana'
where id = (select commission_b from t005_commissions);

-- ============================================================
-- Prueba 1: cliente puede leer sus propias comisiones
-- Esperado: SELECT devuelve al menos 2 filas donde client_id = user_client
-- ============================================================

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_client::text from t005_users),
  true
);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.commissions
  where client_id = (select user_client from t005_users);

  if visible < 2 then
    raise exception 'T005 Prueba 1 FALLO: cliente no puede leer sus propias comisiones (% filas visibles)', visible;
  end if;
end;
$$;

-- ============================================================
-- Prueba 2: cliente NO puede leer comisiones de otro cliente
-- Esperado: SELECT devuelve 0 filas (RLS filtra silenciosamente)
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_stranger::text from t005_users),
  true
);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.commissions
  where client_id = (select user_client from t005_users);

  if visible <> 0 then
    raise exception 'T005 Prueba 2 FALLO: user_stranger puede leer comisiones ajenas (% filas visibles)', visible;
  end if;
end;
$$;

-- ============================================================
-- Prueba 3: cliente NO puede ejecutar UPDATE sobre status
-- Esperado: UPDATE afecta 0 filas (RLS: USING exige auth.uid() = artist_id para UPDATE)
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_client::text from t005_users),
  true
);

do $$
declare
  updated_count integer;
begin
  update public.commissions
  set status = 'COMPLETADA'
  where client_id = (select user_client from t005_users);

  get diagnostics updated_count = row_count;

  if updated_count <> 0 then
    raise exception 'T005 Prueba 3 FALLO: user_client pudo actualizar status (% filas)', updated_count;
  end if;
end;
$$;

-- ============================================================
-- Prueba 4: tercero autenticado no ve ninguna comisión ajena
-- Esperado: 0 filas para cualquier comisión que no le pertenezca
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_stranger::text from t005_users),
  true
);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.commissions
  where client_id = (select user_client from t005_users)
     or artist_id = (select user_artist from t005_users);

  if visible <> 0 then
    raise exception 'T005 Prueba 4 FALLO: user_stranger puede ver comisiones ajenas (% filas visibles)', visible;
  end if;
end;
$$;

-- ============================================================
-- Prueba 5: cliente puede leer rejection_reason en comisiones rechazadas
-- Esperado: fila con status = RECHAZADA y rejection_reason no nulo
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  (select user_client::text from t005_users),
  true
);

do $$
declare
  found_reason text;
begin
  select rejection_reason into found_reason
  from public.commissions
  where id = (select commission_b from t005_commissions)
    and status = 'RECHAZADA';

  if found_reason is null then
    raise exception 'T005 Prueba 5 FALLO: cliente no puede leer rejection_reason de su comisión rechazada';
  end if;
end;
$$;

-- ============================================================
-- Prueba 6: cliente puede leer JOIN con services y profiles (artista)
-- Esperado: fila con title del servicio y handle del artista visibles
-- ============================================================

do $$
declare
  row_count_val integer;
begin
  select count(*) into row_count_val
  from public.commissions c
  join public.services s   on s.id = c.service_id
  join public.profiles p   on p.id = c.artist_id
  where c.client_id = (select user_client from t005_users);

  if row_count_val < 1 then
    raise exception 'T005 Prueba 6 FALLO: cliente no puede leer JOIN con services y profiles (% filas)', row_count_val;
  end if;
end;
$$;

rollback;
