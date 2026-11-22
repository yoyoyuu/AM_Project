-- Tests: Spec 008 — Resolución de eventos de comisión y encolado en pg_net
-- Casos E1–E12 de plan.md §5.2
--
-- Prerequisitos:
--   · Migraciones 001–012 aplicadas.
--   · Reemplazar los dos UUIDs de t008e_users por usuarios autenticados existentes
--     (deben estar en auth.users y en public.profiles).
--   · Si ya existen secretos push_function_url o push_webhook_secret en Vault
--     (por ejemplo tras T007), bórralos antes de correr este test — el ROLLBACK
--     los restaurará.
--   · La transacción hace ROLLBACK al final: no deja datos persistentes.

begin;

-- ═══════════════════════════════════════════════════════════════════
-- Parte 1 — Resolución pura (E1–E8): función resolve_commission_push_event
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v text;
begin
  -- E1: aceptar (PENDIENTE → EN_PROGRESO) ⇒ REQUEST_UPDATED (prioridad sobre STAGE_ADVANCED)
  v := public.resolve_commission_push_event(
    'PENDIENTE','EN_PROGRESO', NULL,'SKETCH', 'UNPAID','UNPAID', NULL,NULL);
  if v is distinct from 'REQUEST_UPDATED' then
    raise exception 'E1 FALLO: aceptar debería dar REQUEST_UPDATED, dio %', v;
  end if;

  -- E2: rechazar (PENDIENTE → RECHAZADA) ⇒ REQUEST_UPDATED
  v := public.resolve_commission_push_event(
    'PENDIENTE','RECHAZADA', NULL,NULL, 'UNPAID','UNPAID', NULL,NULL);
  if v is distinct from 'REQUEST_UPDATED' then
    raise exception 'E2 FALLO: rechazar debería dar REQUEST_UPDATED, dio %', v;
  end if;

  -- E3: SKETCH → LINEART ⇒ STAGE_ADVANCED
  v := public.resolve_commission_push_event(
    'EN_PROGRESO','EN_PROGRESO', 'SKETCH','LINEART', 'UNPAID','UNPAID', NULL,NULL);
  if v is distinct from 'STAGE_ADVANCED' then
    raise exception 'E3 FALLO: avance de etapa debería dar STAGE_ADVANCED, dio %', v;
  end if;

  -- E4a: comprobante enviado (UNPAID → UNDER_REVIEW) ⇒ PAYMENT_PROOF_SUBMITTED
  v := public.resolve_commission_push_event(
    'EN_PROGRESO','EN_PROGRESO', 'LINEART','LINEART', 'UNPAID','UNDER_REVIEW', NULL,NULL);
  if v is distinct from 'PAYMENT_PROOF_SUBMITTED' then
    raise exception 'E4a FALLO: comprobante enviado debería dar PAYMENT_PROOF_SUBMITTED, dio %', v;
  end if;

  -- E4b: comprobante reenviado (NEEDS_CORRECTION → UNDER_REVIEW) ⇒ PAYMENT_PROOF_SUBMITTED
  v := public.resolve_commission_push_event(
    'EN_PROGRESO','EN_PROGRESO', 'LINEART','LINEART', 'NEEDS_CORRECTION','UNDER_REVIEW', NULL,NULL);
  if v is distinct from 'PAYMENT_PROOF_SUBMITTED' then
    raise exception 'E4b FALLO: comprobante reenviado debería dar PAYMENT_PROOF_SUBMITTED, dio %', v;
  end if;

  -- E5a: corrección (UNDER_REVIEW → NEEDS_CORRECTION) ⇒ PAYMENT_UPDATED
  v := public.resolve_commission_push_event(
    'EN_PROGRESO','EN_PROGRESO', 'FINAL','FINAL', 'UNDER_REVIEW','NEEDS_CORRECTION', NULL,NULL);
  if v is distinct from 'PAYMENT_UPDATED' then
    raise exception 'E5a FALLO: corrección debería dar PAYMENT_UPDATED, dio %', v;
  end if;

  -- E5b: verificación sin entregable (UNDER_REVIEW → VERIFIED) ⇒ PAYMENT_UPDATED
  v := public.resolve_commission_push_event(
    'EN_PROGRESO','EN_PROGRESO', 'FINAL','FINAL', 'UNDER_REVIEW','VERIFIED', NULL,NULL);
  if v is distinct from 'PAYMENT_UPDATED' then
    raise exception 'E5b FALLO: verificación sin entregable debería dar PAYMENT_UPDATED, dio %', v;
  end if;

  -- E6: verificación con entregable ⇒ COMPLETADA ⇒ DELIVERABLE_READY (un solo aviso, Escenario 8.19)
  v := public.resolve_commission_push_event(
    'EN_PROGRESO','COMPLETADA', 'FINAL',NULL, 'UNDER_REVIEW','VERIFIED', 'c/final-1.png','c/final-1.png');
  if v is distinct from 'DELIVERABLE_READY' then
    raise exception 'E6 FALLO: completar con entregable debería dar DELIVERABLE_READY, dio %', v;
  end if;

  -- E7: entregable subido con pago pendiente ⇒ DELIVERABLE_READY
  v := public.resolve_commission_push_event(
    'EN_PROGRESO','EN_PROGRESO', 'FINAL','FINAL', 'UNPAID','UNPAID', NULL,'c/final-1.png');
  if v is distinct from 'DELIVERABLE_READY' then
    raise exception 'E7 FALLO: entregable con pago pendiente debería dar DELIVERABLE_READY, dio %', v;
  end if;

  -- E8: cambio sin evento (sin cambios en status/stage/payment/deliverable) ⇒ NULL
  v := public.resolve_commission_push_event(
    'RECHAZADA','RECHAZADA', NULL,NULL, 'UNPAID','UNPAID', NULL,NULL);
  if v is not null then
    raise exception 'E8 FALLO: cambio sin evento debería dar NULL, dio %', v;
  end if;
end;
$$;
select 'E1–E8 OK: resolve_commission_push_event mapea todos los eventos y la prioridad' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- Parte 2 — Encolado real con pg_net (E9–E11)
-- ═══════════════════════════════════════════════════════════════════

-- Secretos temporales en Vault (se restauran al ROLLBACK)
select vault.create_secret(
  'http://localhost:54321/functions/v1/send-push-notification',
  'push_function_url');
select vault.create_secret('test-secret-for-008-events', 'push_webhook_secret');

-- ── Fixtures ───────────────────────────────────────────────────────
create temp table t008e_users (
  user_client uuid not null,
  user_artist uuid not null
);

insert into t008e_users (user_client, user_artist)
values (
  '3e66839e-1423-4251-a51a-06802270caa1',  -- reemplazar con UUID real de cliente
  'b1f8d193-59ab-4e8a-9816-2a5c7fdb487e'   -- reemplazar con UUID real de artista
);

create temp table t008e_service (id uuid);
with svc as (
  insert into public.services (artist_id, title, price_mxn, delivery_days)
  values ((select user_artist from t008e_users), 'T008 servicio de prueba', 500, 14)
  returning id
)
insert into t008e_service select id from svc;

create temp table t008e_commission (id uuid);
with ins as (
  insert into public.commissions (client_id, artist_id, service_id, description, intended_use)
  values (
    (select user_client from t008e_users),
    (select user_artist from t008e_users),
    (select id from t008e_service),
    'T008 comisión de prueba para eventos de push',
    'personal'
  )
  returning id
)
insert into t008e_commission select id from ins;

-- Avanzar a EN_PROGRESO / SKETCH como postgres (bypass RLS y privilegios de columna)
update public.commissions
  set status = 'EN_PROGRESO', current_stage = 'SKETCH'
  where id = (select id from t008e_commission);

-- ═══════════════════════════════════════════════════════════════════
-- E9 — UPDATE de etapa encola exactamente 1 petición con recipient = cliente
-- Esperado: +1 en net.http_request_queue; recipient_id = user_client
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  n_before bigint;
  n_after  bigint;
  last_recipient text;
  last_event     text;
begin
  select count(*) into n_before from net.http_request_queue;

  update public.commissions
    set current_stage = 'LINEART'
    where id = (select id from t008e_commission);

  select count(*) into n_after from net.http_request_queue;
  if n_after - n_before <> 1 then
    raise exception 'E9 FALLO: avance de etapa debería encolar 1 petición, encoló %', n_after - n_before;
  end if;

  select convert_from(body, 'UTF8')::jsonb ->> 'recipient_id',
         convert_from(body, 'UTF8')::jsonb ->> 'event'
    into last_recipient, last_event
    from net.http_request_queue
    order by id desc
    limit 1;

  if last_event is distinct from 'STAGE_ADVANCED' then
    raise exception 'E9 FALLO: evento encolado debería ser STAGE_ADVANCED, fue %', last_event;
  end if;
  if last_recipient is distinct from (select user_client::text from t008e_users) then
    raise exception 'E9 FALLO: recipient debería ser el cliente, fue %', last_recipient;
  end if;
end;
$$;
select 'E9 OK: avance de etapa encola 1 petición STAGE_ADVANCED al cliente' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- E10 — UPDATE sin cambios relevantes NO encola nada (WHEN del trigger)
-- Esperado: +0 en net.http_request_queue
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  n_before bigint;
  n_after  bigint;
begin
  select count(*) into n_before from net.http_request_queue;

  -- rejection_reason NO está en la cláusula WHEN del trigger
  update public.commissions
    set rejection_reason = null
    where id = (select id from t008e_commission);

  select count(*) into n_after from net.http_request_queue;
  if n_after - n_before <> 0 then
    raise exception 'E10 FALLO: UPDATE irrelevante no debería encolar, encoló %', n_after - n_before;
  end if;
end;
$$;
select 'E10 OK: UPDATE sin cambios en status/stage/payment/deliverable no encola nada' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- E11 — 3 archivos de un avance en una sola sentencia ⇒ 1 aviso NEW_ADVANCE
-- Esperado: +1 en net.http_request_queue (statement-level trigger)
-- ═══════════════════════════════════════════════════════════════════
create temp table t008e_advance (id uuid);
with ins as (
  insert into public.commission_advances (commission_id, artist_id, stage)
  values (
    (select id from t008e_commission),
    (select user_artist from t008e_users),
    'LINEART'
  )
  returning id
)
insert into t008e_advance select id from ins;

do $$
declare
  n_before bigint;
  n_after  bigint;
  last_recipient text;
  last_event     text;
  v_advance_id uuid := (select id from t008e_advance);
begin
  select count(*) into n_before from net.http_request_queue;

  insert into public.commission_advance_files (advance_id, storage_path, file_size, sort_order)
  values
    (v_advance_id, 'c/adv/0.webp', 1000, 0),
    (v_advance_id, 'c/adv/1.webp', 1000, 1),
    (v_advance_id, 'c/adv/2.webp', 1000, 2);

  select count(*) into n_after from net.http_request_queue;
  if n_after - n_before <> 1 then
    raise exception 'E11 FALLO: avance con 3 archivos debería encolar 1 petición, encoló %', n_after - n_before;
  end if;

  select convert_from(body, 'UTF8')::jsonb ->> 'recipient_id',
         convert_from(body, 'UTF8')::jsonb ->> 'event'
    into last_recipient, last_event
    from net.http_request_queue
    order by id desc
    limit 1;

  if last_event is distinct from 'NEW_ADVANCE' then
    raise exception 'E11 FALLO: evento debería ser NEW_ADVANCE, fue %', last_event;
  end if;
  if last_recipient is distinct from (select user_client::text from t008e_users) then
    raise exception 'E11 FALLO: recipient debería ser el cliente, fue %', last_recipient;
  end if;
end;
$$;
select 'E11 OK: avance con 3 archivos en una sentencia encola 1 aviso NEW_ADVANCE' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- E12 — Sin secretos en Vault, la mutación NO falla (RNF-NOT-8.4)
-- Esperado: UPDATE 1 + WARNING «push notifications not configured»
--           ningún aviso nuevo en net.http_request_queue
-- ═══════════════════════════════════════════════════════════════════
delete from vault.secrets where name in ('push_function_url', 'push_webhook_secret');

do $$
declare
  n_before bigint;
  n_after  bigint;
  n_upd    int;
begin
  select count(*) into n_before from net.http_request_queue;

  update public.commissions
    set current_stage = 'FINAL'
    where id = (select id from t008e_commission);
  get diagnostics n_upd = row_count;

  if n_upd <> 1 then
    raise exception 'E12 FALLO: UPDATE sin secretos debería afectar 1 fila, afectó %', n_upd;
  end if;

  select count(*) into n_after from net.http_request_queue;
  if n_after - n_before <> 0 then
    raise exception 'E12 FALLO: sin secretos no debería encolar, encoló %', n_after - n_before;
  end if;
end;
$$;
select 'E12 OK: sin secretos en Vault, la mutación sigue funcionando y no se encola nada' as resultado;

-- ═══════════════════════════════════════════════════════════════════
-- Fin — ROLLBACK: no deja datos persistentes (ni comisión, ni secretos)
-- ═══════════════════════════════════════════════════════════════════
rollback;
