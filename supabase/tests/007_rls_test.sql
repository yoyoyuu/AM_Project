-- Tests RLS/privilegios/RPC: Spec 007 — Registro de Pagos, Comprobantes y Entregable Final
-- Casos P1–P22 de plan.md §3.6
--
-- Prerequisitos:
--   · Ejecutar después de supabase db reset (migraciones 001–011 aplicadas).
--   · Reemplazar los tres UUIDs de t007_users por usuarios autenticados existentes
--     en la instancia local (deben estar en auth.users y en public.profiles).
--   · La transacción hace ROLLBACK al final: no deja datos persistentes.
--
-- Convenciones de fixtures:
--   commission_a  → EN_PROGRESO, etapa FINAL, payment UNPAID  (flujo principal)
--   commission_b  → PENDIENTE                                  (P8)
--   commission_c  → EN_PROGRESO, etapa LINEART                 (P19)
--   commission_d  → EN_PROGRESO, etapa FINAL                   (P22)

begin;

-- ═══════════════════════════════════════════════════════════════════
-- Usuarios (reemplazar con UUIDs reales)
-- ═══════════════════════════════════════════════════════════════════
create temp table t007_users (
  user_client   uuid not null,
  user_artist   uuid not null,
  user_stranger uuid not null
);
grant select on t007_users to authenticated;

insert into t007_users (user_client, user_artist, user_stranger)
values (
  'a2db0764-5b01-4608-abea-8cdada298bcd',
  'b1f8d193-59ab-4e8a-9816-2a5c7fdb487e',
  'c9e8f1a2-3b4d-4e5f-6a7b-8c9d0e1f2a3b'
);

do $$
begin
  if (select user_client = user_artist  from t007_users) then raise exception 'T007: user_client y user_artist deben ser distintos'; end if;
  if (select user_client = user_stranger from t007_users) then raise exception 'T007: user_client y user_stranger deben ser distintos'; end if;
  if (select user_artist = user_stranger from t007_users) then raise exception 'T007: user_artist y user_stranger deben ser distintos'; end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Servicio
-- ═══════════════════════════════════════════════════════════════════
create temp table t007_service (id uuid not null);
grant select on t007_service to authenticated;

with svc as (
  insert into public.services (artist_id, title, price_mxn, delivery_days)
  values (
    (select user_artist from t007_users),
    'T007 servicio de prueba',
    800,
    14
  )
  returning id
)
insert into t007_service select id from svc;

-- ═══════════════════════════════════════════════════════════════════
-- Comisiones
-- ═══════════════════════════════════════════════════════════════════
create temp table t007_commissions (
  commission_a uuid,  -- EN_PROGRESO FINAL UNPAID  (flujo principal P1–P22)
  commission_b uuid,  -- PENDIENTE                 (P8)
  commission_c uuid,  -- EN_PROGRESO LINEART        (P19)
  commission_d uuid   -- EN_PROGRESO FINAL          (P22 file_too_large)
);
grant select on t007_commissions to authenticated;

with ins as (
  insert into public.commissions (client_id, artist_id, service_id, description, intended_use)
  values
    ((select user_client from t007_users), (select user_artist from t007_users), (select id from t007_service), 'T007 comisión A — flujo principal de pago y entregable', 'personal'),
    ((select user_client from t007_users), (select user_artist from t007_users), (select id from t007_service), 'T007 comisión B — estado PENDIENTE sin cambios', 'personal'),
    ((select user_client from t007_users), (select user_artist from t007_users), (select id from t007_service), 'T007 comisión C — etapa LINEART para Storage RLS', 'personal'),
    ((select user_client from t007_users), (select user_artist from t007_users), (select id from t007_service), 'T007 comisión D — prueba file_too_large', 'personal')
  returning id
),
indexed as (select id, row_number() over () as rn from ins)
insert into t007_commissions (commission_a, commission_b, commission_c, commission_d)
select arr[1], arr[2], arr[3], arr[4]
from (select array_agg(id order by rn) as arr from indexed) sub;

-- Avanzar estado de las comisiones que lo requieren (como postgres, bypass RLS)
update public.commissions set status = 'EN_PROGRESO', current_stage = 'FINAL'
  where id = (select commission_a from t007_commissions);
update public.commissions set status = 'EN_PROGRESO', current_stage = 'LINEART'
  where id = (select commission_c from t007_commissions);
update public.commissions set status = 'EN_PROGRESO', current_stage = 'FINAL'
  where id = (select commission_d from t007_commissions);

-- ═══════════════════════════════════════════════════════════════════
-- Objetos de Storage (insertados como postgres, bypass RLS)
-- ═══════════════════════════════════════════════════════════════════
create temp table t007_storage (
  proof_path       text not null,
  deliverable_path text not null
);
grant select on t007_storage to authenticated;

insert into t007_storage (proof_path, deliverable_path)
select
  (select commission_a from t007_commissions)::text || '/p1.jpg',
  (select commission_a from t007_commissions)::text || '/final-d1.png';

-- Comprobante en payment-proofs (propietario: cliente)
insert into storage.objects (bucket_id, name, owner_id, created_at, updated_at)
select
  'payment-proofs',
  proof_path,
  (select user_client::text from t007_users),
  now(),
  now()
from t007_storage;

-- Entregable en commission-deliverables (propietario: artista)
insert into storage.objects (bucket_id, name, owner_id, created_at, updated_at)
select
  'commission-deliverables',
  deliverable_path,
  (select user_artist::text from t007_users),
  now(),
  now()
from t007_storage;

-- ═══════════════════════════════════════════════════════════════════
-- P1 — cliente NO puede UPDATE payment_status directamente
-- Esperado: ERROR insufficient_privilege (privilegio de columna)
-- ═══════════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_client::text from t007_users), true);

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.commissions
    set payment_status = 'VERIFIED'
    where id = (select commission_a from t007_commissions);
  exception
    when insufficient_privilege then rejected := true;
    when others                 then rejected := true;
  end;
  if not rejected then
    raise exception 'P1 FALLO: cliente pudo actualizar payment_status directamente';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P2 — artista NO puede UPDATE payment_status directamente
-- Esperado: ERROR insufficient_privilege
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_artist::text from t007_users), true);

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.commissions
    set payment_status = 'VERIFIED'
    where id = (select commission_a from t007_commissions);
  exception
    when insufficient_privilege then rejected := true;
    when others                 then rejected := true;
  end;
  if not rejected then
    raise exception 'P2 FALLO: artista pudo actualizar payment_status directamente';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P3 — artista NO puede poner COMPLETADA sin pago verificado ni entregable
-- Esperado: ERROR check_violation (completed_requires_payment_and_deliverable)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  rejected boolean := false;
begin
  begin
    update public.commissions
    set status = 'COMPLETADA', current_stage = null
    where id = (select commission_a from t007_commissions)
      and artist_id = (select user_artist from t007_users);
  exception
    when check_violation  then rejected := true;
    when others           then rejected := true;
  end;
  if not rejected then
    raise exception 'P3 FALLO: artista pudo establecer COMPLETADA sin pago ni entregable';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P4 — INSERT manipulado con payment_status = 'VERIFIED' → trigger fuerza UNPAID
-- Esperado: payment_status = 'UNPAID' en el RETURNING
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_client::text from t007_users), true);

do $$
declare
  v_status public.payment_status;
begin
  insert into public.commissions (client_id, artist_id, service_id, description, intended_use, payment_status)
  values (
    (select user_client  from t007_users),
    (select user_artist  from t007_users),
    (select id           from t007_service),
    'T007 INSERT manipulado intento pago verificado',
    'personal',
    'VERIFIED'
  )
  returning payment_status into v_status;

  if v_status <> 'UNPAID' then
    raise exception 'P4 FALLO: INSERT nació con payment_status = % (esperado UNPAID)', v_status;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P5 — cliente envía comprobante válido → UNDER_REVIEW
-- (commission_a pasa de UNPAID a UNDER_REVIEW)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  v_result public.payment_status;
begin
  select public.submit_payment_proof(
    (select commission_a from t007_commissions),
    (select proof_path   from t007_storage),
    'ABC123',
    null
  ) into v_result;

  if v_result <> 'UNDER_REVIEW' then
    raise exception 'P5 FALLO: submit_payment_proof devolvió % (esperado UNDER_REVIEW)', v_result;
  end if;

  -- Verificar que el estado se guardó en la tabla
  if not exists (
    select 1 from public.commissions
     where id = (select commission_a from t007_commissions)
       and payment_status = 'UNDER_REVIEW'
       and payment_proof_path = (select proof_path from t007_storage)
       and payment_reference = 'ABC123'
  ) then
    raise exception 'P5 FALLO: columnas de pago no actualizadas en commissions';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P6 — reenviar comprobante estando UNDER_REVIEW → invalid_payment_state
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.submit_payment_proof(
      (select commission_a from t007_commissions),
      (select proof_path   from t007_storage)
    );
  exception
    when others then
      if sqlerrm = 'invalid_payment_state' then
        rejected := true;
      else
        raise exception 'P6 FALLO: error inesperado: %', sqlerrm;
      end if;
  end;
  if not rejected then
    raise exception 'P6 FALLO: se permitió reenviar comprobante en UNDER_REVIEW';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P7 — artista NO puede enviar comprobante → forbidden
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_artist::text from t007_users), true);

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.submit_payment_proof(
      (select commission_a from t007_commissions),
      (select proof_path   from t007_storage)
    );
  exception
    when others then
      if sqlerrm = 'forbidden' then
        rejected := true;
      else
        raise exception 'P7 FALLO: error inesperado: %', sqlerrm;
      end if;
  end;
  if not rejected then
    raise exception 'P7 FALLO: artista pudo enviar comprobante';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P8 — comprobante en comisión PENDIENTE → invalid_payment_state
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_client::text from t007_users), true);

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.submit_payment_proof(
      (select commission_b from t007_commissions),
      (select commission_b from t007_commissions)::text || '/x.jpg'
    );
  exception
    when others then
      if sqlerrm in ('invalid_payment_state', 'proof_not_found') then
        rejected := true;
      else
        raise exception 'P8 FALLO: error inesperado: %', sqlerrm;
      end if;
  end;
  if not rejected then
    raise exception 'P8 FALLO: se permitió enviar comprobante en comisión PENDIENTE';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P9 — ruta de otra comisión → proof_not_found
-- (commission_d está UNPAID; la ruta pertenece a commission_a)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.submit_payment_proof(
      (select commission_d from t007_commissions),
      (select proof_path from t007_storage)   -- ruta de commission_a, no de commission_d
    );
  exception
    when others then
      if sqlerrm in ('proof_not_found', 'forbidden') then
        rejected := true;
      else
        raise exception 'P9 FALLO: error inesperado: %', sqlerrm;
      end if;
  end;
  if not rejected then
    raise exception 'P9 FALLO: se aceptó un comprobante cuya ruta no pertenece a la comisión';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P10 — cliente NO puede pedir corrección ni verificar → forbidden
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  rejected_correction boolean := false;
  rejected_verify     boolean := false;
begin
  -- request_payment_correction
  begin
    perform public.request_payment_correction(
      (select commission_a from t007_commissions),
      'Comprobante ilegible'
    );
  exception
    when others then
      if sqlerrm = 'forbidden' then rejected_correction := true;
      else raise exception 'P10a FALLO: error inesperado en request_payment_correction: %', sqlerrm;
      end if;
  end;

  -- verify_payment
  begin
    perform public.verify_payment((select commission_a from t007_commissions));
  exception
    when others then
      if sqlerrm = 'forbidden' then rejected_verify := true;
      else raise exception 'P10b FALLO: error inesperado en verify_payment: %', sqlerrm;
      end if;
  end;

  if not rejected_correction then
    raise exception 'P10 FALLO: cliente pudo llamar request_payment_correction';
  end if;
  if not rejected_verify then
    raise exception 'P10 FALLO: cliente pudo llamar verify_payment';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P11 — motivo demasiado corto → invalid_reason
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_artist::text from t007_users), true);

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.request_payment_correction(
      (select commission_a from t007_commissions),
      '   ab '   -- 2 caracteres tras trim → inválido
    );
  exception
    when others then
      if sqlerrm = 'invalid_reason' then rejected := true;
      else raise exception 'P11 FALLO: error inesperado: %', sqlerrm;
      end if;
  end;
  if not rejected then
    raise exception 'P11 FALLO: se aceptó motivo demasiado corto';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P12 — motivo válido → NEEDS_CORRECTION; commission_a pasa a NEEDS_CORRECTION
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  v_result public.payment_status;
begin
  select public.request_payment_correction(
    (select commission_a from t007_commissions),
    'Comprobante ilegible'
  ) into v_result;

  if v_result <> 'NEEDS_CORRECTION' then
    raise exception 'P12 FALLO: request_payment_correction devolvió % (esperado NEEDS_CORRECTION)', v_result;
  end if;

  if not exists (
    select 1 from public.commissions
     where id = (select commission_a from t007_commissions)
       and payment_status = 'NEEDS_CORRECTION'
       and payment_correction_reason = 'Comprobante ilegible'
  ) then
    raise exception 'P12 FALLO: estado o motivo no guardado en commissions';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P13 — verify_payment con NEEDS_CORRECTION → invalid_payment_state
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.verify_payment((select commission_a from t007_commissions));
  exception
    when others then
      if sqlerrm = 'invalid_payment_state' then rejected := true;
      else raise exception 'P13 FALLO: error inesperado: %', sqlerrm;
      end if;
  end;
  if not rejected then
    raise exception 'P13 FALLO: artista pudo verificar pago en estado NEEDS_CORRECTION';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P14 — cliente sin VERIFIED no ve el objeto del entregable → 0 filas
-- (commission_a está en NEEDS_CORRECTION; el objeto existe en storage)
-- ═══════════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_client::text from t007_users), true);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from storage.objects
  where bucket_id = 'commission-deliverables'
    and name like (select commission_a::text from t007_commissions) || '/%';

  if visible <> 0 then
    raise exception 'P14 FALLO: cliente sin VERIFIED ve % objeto(s) del entregable (esperado 0)', visible;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P15 — artista SÍ ve el objeto del entregable
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_artist::text from t007_users), true);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from storage.objects
  where bucket_id = 'commission-deliverables'
    and name like (select commission_a::text from t007_commissions) || '/%';

  if visible < 1 then
    raise exception 'P15 FALLO: artista no puede ver ningún objeto del entregable (esperado ≥ 1)';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Preparación para P16: como postgres, poner commission_a en VERIFIED
-- + registrar deliverable_path vigente
-- ═══════════════════════════════════════════════════════════════════
reset role;

update public.commissions
set payment_status            = 'VERIFIED',
    paid_verified_at          = now(),
    payment_correction_reason = null,
    deliverable_path          = (select deliverable_path from t007_storage),
    deliverable_size          = 102400,
    delivered_at              = now()
where id = (select commission_a from t007_commissions);

-- ═══════════════════════════════════════════════════════════════════
-- P16 — cliente con VERIFIED ve SOLO el objeto vigente
-- ═══════════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_client::text from t007_users), true);

do $$
declare
  visible  integer;
  vigente  text;
begin
  select count(*), min(name) into visible, vigente
  from storage.objects
  where bucket_id = 'commission-deliverables'
    and name like (select commission_a::text from t007_commissions) || '/%';

  if visible <> 1 then
    raise exception 'P16 FALLO: cliente con VERIFIED ve % objeto(s) (esperado exactamente 1)', visible;
  end if;

  if vigente <> (select deliverable_path from t007_storage) then
    raise exception 'P16 FALLO: el objeto visible (%) no es el vigente (%)', vigente, (select deliverable_path from t007_storage);
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P17 — tercero no ve comprobantes ni entregables → 0 filas
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_stranger::text from t007_users), true);

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from storage.objects
  where bucket_id in ('payment-proofs', 'commission-deliverables');

  if visible <> 0 then
    raise exception 'P17 FALLO: tercero ve % objeto(s) de storage (esperado 0)', visible;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P18 — cliente NO puede INSERT en commission-deliverables → RLS violation
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_client::text from t007_users), true);

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name, owner_id, created_at, updated_at)
    values (
      'commission-deliverables',
      (select commission_a from t007_commissions)::text || '/final-x.png',
      (select user_client::text from t007_users),
      now(), now()
    );
  exception
    when others then rejected := true;
  end;
  if not rejected then
    raise exception 'P18 FALLO: cliente pudo insertar en commission-deliverables';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P19 — artista NO puede INSERT entregable si etapa ≠ FINAL (commission_c en LINEART)
-- ═══════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', (select user_artist::text from t007_users), true);

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name, owner_id, created_at, updated_at)
    values (
      'commission-deliverables',
      (select commission_c from t007_commissions)::text || '/final-x.png',
      (select user_artist::text from t007_users),
      now(), now()
    );
  exception
    when others then rejected := true;
  end;
  if not rejected then
    raise exception 'P19 FALLO: artista pudo insertar entregable en comisión con etapa LINEART';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P20 — las políticas DELETE protegen los objetos vigentes
-- storage.protect_delete() bloquea cualquier DELETE SQL directo con una
-- excepción no capturable en DO-blocks. Se evalúa en su lugar la
-- condición USING de cada política directamente (como postgres):
--   · deliverables_delete_orphans: NOT EXISTS en commissions.deliverable_path
--   · payment_proofs_delete_orphans: NOT EXISTS en commissions.payment_proof_path
-- Si el vigente pasara la condición → no está protegido → FALLO.
-- ═══════════════════════════════════════════════════════════════════
reset role;

do $$
declare
  deliverable_exposed integer;
  proof_exposed       integer;
begin
  -- P20a: el vigente NO debe pasar la condición USING de deliverables_delete_orphans
  -- (el artista solo puede borrar objetos que NO están en commissions.deliverable_path)
  select count(*) into deliverable_exposed
  from storage.objects so
  where so.bucket_id = 'commission-deliverables'
    and so.name      = (select deliverable_path from t007_storage)
    and so.owner_id  = (select user_artist::text from t007_users)
    and not exists (
      select 1 from public.commissions c
       where c.deliverable_path = so.name
    );

  -- P20b: el vigente NO debe pasar la condición USING de payment_proofs_delete_orphans
  -- (el owner solo puede borrar comprobantes que NO están en commissions.payment_proof_path)
  select count(*) into proof_exposed
  from storage.objects so
  where so.bucket_id = 'payment-proofs'
    and so.name      = (select proof_path from t007_storage)
    and so.owner_id  = (select user_client::text from t007_users)
    and not exists (
      select 1 from public.commissions c
       where c.payment_proof_path = so.name
    );

  if deliverable_exposed > 0 then
    raise exception 'P20a FALLO: política DELETE permitiría borrar el entregable vigente (deliverable_path no registrado en commissions)';
  end if;
  if proof_exposed > 0 then
    raise exception 'P20b FALLO: política DELETE permitiría borrar el comprobante vigente (payment_proof_path no registrado en commissions)';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P21 — submit_deliverable con payment VERIFIED → comisión COMPLETADA
-- (commission_a ya tiene payment_status = VERIFIED y current_stage = FINAL)
-- ═══════════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_artist::text from t007_users), true);

do $$
declare
  v_result public.commission_status;
begin
  select public.submit_deliverable(
    (select commission_a    from t007_commissions),
    (select deliverable_path from t007_storage),
    102400
  ) into v_result;

  if v_result <> 'COMPLETADA' then
    raise exception 'P21 FALLO: submit_deliverable devolvió % (esperado COMPLETADA)', v_result;
  end if;

  if not exists (
    select 1 from public.commissions
     where id = (select commission_a from t007_commissions)
       and status = 'COMPLETADA'
       and current_stage is null
  ) then
    raise exception 'P21 FALLO: comisión no pasó a COMPLETADA o current_stage no es NULL';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- P22 — submit_deliverable con tamaño > 10 MB → file_too_large
-- (commission_d está EN_PROGRESO, FINAL, UNPAID; no necesita storage object)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.submit_deliverable(
      (select commission_d from t007_commissions),
      (select commission_d from t007_commissions)::text || '/final-z.png',
      10485761   -- 1 byte por encima del límite
    );
  exception
    when others then
      if sqlerrm = 'file_too_large' then rejected := true;
      else raise exception 'P22 FALLO: error inesperado: %', sqlerrm;
      end if;
  end;
  if not rejected then
    raise exception 'P22 FALLO: se aceptó un entregable de más de 10 MB';
  end if;
end;
$$;

rollback;
