-- Tests RLS/RPC: Spec 008 — Notificaciones Push — device_tokens
-- Casos D1–D11 de plan.md §5.1
--
-- Prerequisitos:
--   · Migraciones 001–012 aplicadas.
--   · Reemplazar los dos UUIDs de t008_users por usuarios autenticados existentes
--     en la instancia (deben estar en auth.users y en public.profiles).
--   · La transacción hace ROLLBACK al final: no deja datos persistentes.

begin;

-- ═══════════════════════════════════════════════════════════════════
-- Usuarios (reemplazar con UUIDs reales)
-- ═══════════════════════════════════════════════════════════════════
create temp table t008_users (
  user_a uuid not null,
  user_b uuid not null
);
grant select on t008_users to authenticated;

insert into t008_users (user_a, user_b)
values (
  'b1f8d193-59ab-4e8a-9816-2a5c7fdb487e',  -- reemplazar con UUID real de usuario A
  '3e66839e-1423-4251-a51a-06802270caa1'   -- reemplazar con UUID real de usuario B
);

do $$
begin
  if (select user_a = user_b from t008_users) then
    raise exception 'T008: user_a y user_b deben ser distintos';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Fixture: token de user_a (insertado como postgres, bypass RLS)
-- ═══════════════════════════════════════════════════════════════════
insert into public.device_tokens (user_id, expo_push_token)
values (
  (select user_a from t008_users),
  'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'
);

-- ═══════════════════════════════════════════════════════════════════
-- D1 — A ve su propio token
-- Esperado: 1 fila
-- ═══════════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_a::text from t008_users), true);

do $$
begin
  if (select count(*) from public.device_tokens) <> 1 then
    raise exception 'D1 FALLO: A debería ver exactamente 1 token propio';
  end if;
end;
$$;
select 'D1 OK: A ve su propio token (1 fila)' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D2 — B NO ve el token de A (acceso denegado)
-- Esperado: 0 filas
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_b::text from t008_users), true);

do $$
begin
  if (select count(*) from public.device_tokens) <> 0 then
    raise exception 'D2 FALLO: B no debería ver ningún token de A';
  end if;
end;
$$;
select 'D2 OK: B no ve el token de A (0 filas)' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D3 — B NO puede insertar un token a nombre de A
-- Esperado: ERROR row-level security policy
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.device_tokens (user_id, expo_push_token)
    values (
      (select user_a from t008_users),
      'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]'
    );
  exception
    when others then rejected := true;
  end;
  if not rejected then
    raise exception 'D3 FALLO: B pudo insertar un token a nombre de A';
  end if;
end;
$$;
select 'D3 OK: B no puede insertar token para A (RLS WITH CHECK)' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D4 — B NO puede actualizar el token de A
-- Esperado: UPDATE 0
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  n int;
begin
  update public.device_tokens
    set user_id = (select user_b from t008_users)
  where expo_push_token = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'D4 FALLO: B pudo actualizar el token de A (% filas)', n;
  end if;
end;
$$;
select 'D4 OK: B no puede actualizar token de A (UPDATE 0)' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D5 — B NO puede borrar el token de A
-- Esperado: DELETE 0
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  n int;
begin
  delete from public.device_tokens
  where expo_push_token = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'D5 FALLO: B pudo borrar el token de A (% filas)', n;
  end if;
end;
$$;
select 'D5 OK: B no puede borrar token de A (DELETE 0)' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D6 — A NO puede «regalar» su token a B (WITH CHECK en UPDATE)
-- Esperado: ERROR row-level security policy
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_a::text from t008_users), true);

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.device_tokens
      set user_id = (select user_b from t008_users)
    where expo_push_token = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
  exception
    when others then rejected := true;
  end;
  if not rejected then
    raise exception 'D6 FALLO: A pudo transferir su token a B';
  end if;
end;
$$;
select 'D6 OK: A no puede ceder su token a B (WITH CHECK)' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D7 — Formato inválido rechazado por CHECK constraint
-- Esperado: ERROR violates check constraint "device_tokens_token_format"
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.register_device_token('not-a-valid-token');
  exception
    when check_violation then rejected := true;
    when others          then rejected := true;
  end;
  if not rejected then
    raise exception 'D7 FALLO: register_device_token aceptó un token con formato inválido';
  end if;
end;
$$;
select 'D7 OK: formato inválido rechazado (CHECK constraint)' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D8 — register_device_token reasigna el token de A a B (Escenario 8.8)
-- Esperado: 1 fila con user_id = user_b; A no ve ningún token
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_b::text from t008_users), true);

select public.register_device_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]');

do $$
declare
  owner_id uuid;
begin
  -- Verificar como postgres que la fila ahora pertenece a B
  reset role;
  select user_id into owner_id from public.device_tokens
    where expo_push_token = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
  if owner_id is distinct from (select user_b from t008_users) then
    raise exception 'D8 FALLO: el token no fue reasignado a B (owner_id=%, esperado=%)', owner_id, (select user_b from t008_users);
  end if;
end;
$$;

-- A ya no ve el token (fue reasignado a B)
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_a::text from t008_users), true);
do $$
begin
  if (select count(*) from public.device_tokens) <> 0 then
    raise exception 'D8 FALLO: A todavía ve el token después de que fue reasignado a B';
  end if;
end;
$$;
select 'D8 OK: register_device_token reasigna el token de A a B (Escenario 8.8)' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D9 — A borra su propio token (logout, Escenario 8.10)
-- Prerequisito: re-insertar un token para A primero
-- Esperado: DELETE 1
-- ═══════════════════════════════════════════════════════════════════
select public.register_device_token('ExponentPushToken[cccccccccccccccccccccc]');

do $$
declare
  n int;
begin
  delete from public.device_tokens
  where expo_push_token = 'ExponentPushToken[cccccccccccccccccccccc]';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'D9 FALLO: A debería poder borrar su propio token (DELETE %, esperado 1)', n;
  end if;
end;
$$;
select 'D9 OK: A borra su propio token (DELETE 1)' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D10 — anon no puede leer ni ejecutar nada
-- Esperado: ERROR permission denied
-- ═══════════════════════════════════════════════════════════════════
set local role anon;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform count(*) from public.device_tokens;
  exception
    when insufficient_privilege then rejected := true;
    when others                 then rejected := true;
  end;
  if not rejected then
    raise exception 'D10 FALLO: anon pudo leer device_tokens';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.register_device_token('ExponentPushToken[dddddddddddddddddddddd]');
  exception
    when insufficient_privilege then rejected := true;
    when others                 then rejected := true;
  end;
  if not rejected then
    raise exception 'D10 FALLO: anon pudo ejecutar register_device_token';
  end if;
end;
$$;
select 'D10 OK: anon sin acceso a device_tokens ni a register_device_token' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- D11 — authenticated NO puede encolar avisos directamente
-- Esperado: ERROR permission denied for function
-- ═══════════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_a::text from t008_users), true);

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.enqueue_push_notification(
      'NEW_REQUEST',
      gen_random_uuid(),
      (select user_a from t008_users)
    );
  exception
    when insufficient_privilege then rejected := true;
    when others                 then rejected := true;
  end;
  if not rejected then
    raise exception 'D11 FALLO: authenticated pudo llamar enqueue_push_notification directamente';
  end if;
end;
$$;
select 'D11 OK: authenticated no puede encolar avisos directamente' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- Fin — ROLLBACK: no deja datos persistentes
-- ═══════════════════════════════════════════════════════════════════
rollback;
