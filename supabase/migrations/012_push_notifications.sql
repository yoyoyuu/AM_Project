-- ═══════════════════════════════════════════════════════════════════
-- Spec 008 — Notificaciones Push
-- Migración 012: device_tokens, RLS y RPC register_device_token
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- 1. Tabla de dispositivos registrados (RF-25-A, RNF-NOT-8.2)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.device_tokens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expo_push_token text        NOT NULL
    CONSTRAINT device_tokens_token_format
      CHECK (char_length(expo_push_token) <= 200
             AND expo_push_token ~ '^Expo(nent)?PushToken\[.+\]$'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_expo_push_token_key UNIQUE (expo_push_token)
);

-- La Edge Function busca por destinatario
CREATE INDEX idx_device_tokens_user_id ON public.device_tokens (user_id);

-- Reutiliza public.set_updated_at() (Spec 001 / Spec 004)
CREATE TRIGGER device_tokens_set_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.device_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;

CREATE POLICY "device_tokens_select_own"
  ON public.device_tokens FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "device_tokens_insert_own"
  ON public.device_tokens FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "device_tokens_update_own"
  ON public.device_tokens FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "device_tokens_delete_own"
  ON public.device_tokens FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Upsert con reasignación del dispositivo a la cuenta actual (P-8.7)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.register_device_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- El CHECK device_tokens_token_format rechaza valores mal formados (23514).
  INSERT INTO public.device_tokens (user_id, expo_push_token)
  VALUES (auth.uid(), p_token)
  ON CONFLICT (expo_push_token)
  DO UPDATE SET user_id    = EXCLUDED.user_id,
                updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device_token(text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 3. pg_net: HTTP asíncrono desde Postgres (se envía tras el COMMIT)
-- ═══════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Encolar un aviso. NUNCA lanza excepción (RNF-NOT-8.4).
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enqueue_push_notification(
  p_event         text,
  p_commission_id uuid,
  p_recipient_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'push_function_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'push notifications not configured (vault secrets missing)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url                  := v_url,
    body                 := jsonb_build_object(
                              'event',         p_event,
                              'commission_id', p_commission_id,
                              'recipient_id',  p_recipient_id),
    headers              := jsonb_build_object(
                              'Content-Type',          'application/json',
                              'x-koma-webhook-secret', v_secret),
    timeout_milliseconds := 10000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_push_notification failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_push_notification(text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Decide qué aviso genera un UPDATE de commissions (spec §5).
--    Devuelve NULL si no hay aviso. El orden del CASE es la prioridad.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resolve_commission_push_event(
  p_old_status      public.commission_status,
  p_new_status      public.commission_status,
  p_old_stage       public.creative_stage,
  p_new_stage       public.creative_stage,
  p_old_payment     public.payment_status,
  p_new_payment     public.payment_status,
  p_old_deliverable text,
  p_new_deliverable text
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    -- 1. E7: comisión completada o entregable subido/reemplazado
    WHEN p_new_status = 'COMPLETADA'
         AND p_old_status IS DISTINCT FROM 'COMPLETADA'                 THEN 'DELIVERABLE_READY'
    WHEN p_new_deliverable IS NOT NULL
         AND p_new_deliverable IS DISTINCT FROM p_old_deliverable       THEN 'DELIVERABLE_READY'
    -- 2. E3: solicitud resuelta (absorbe la entrada a SKETCH al aceptar)
    WHEN p_old_status = 'PENDIENTE'
         AND p_new_status IN ('EN_PROGRESO', 'RECHAZADA')               THEN 'REQUEST_UPDATED'
    -- 3. E2: comprobante enviado / reenviado (al artista)
    WHEN p_new_payment = 'UNDER_REVIEW'
         AND p_old_payment IS DISTINCT FROM 'UNDER_REVIEW'              THEN 'PAYMENT_PROOF_SUBMITTED'
    -- 4. E6: pago confirmado o corrección solicitada
    WHEN p_new_payment IN ('VERIFIED', 'NEEDS_CORRECTION')
         AND p_new_payment IS DISTINCT FROM p_old_payment               THEN 'PAYMENT_UPDATED'
    -- 5. E4: avance de etapa dentro de EN_PROGRESO
    WHEN p_old_status = 'EN_PROGRESO' AND p_new_status = 'EN_PROGRESO'
         AND p_new_stage IS NOT NULL
         AND p_new_stage IS DISTINCT FROM p_old_stage                   THEN 'STAGE_ADVANCED'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.resolve_commission_push_event(
  public.commission_status, public.commission_status,
  public.creative_stage, public.creative_stage,
  public.payment_status, public.payment_status, text, text
) FROM PUBLIC, anon;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Triggers
-- ═══════════════════════════════════════════════════════════════════

-- 6.1 E1 — nueva solicitud (Spec 003)
CREATE OR REPLACE FUNCTION public.notify_commission_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.enqueue_push_notification('NEW_REQUEST', NEW.id, NEW.artist_id);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_commission_insert failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE TRIGGER commissions_push_on_insert
  AFTER INSERT ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_commission_insert();

-- 6.2 E2, E3, E4, E6, E7 — cambios de estado, etapa, pago y entregable
CREATE OR REPLACE FUNCTION public.notify_commission_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event text;
BEGIN
  v_event := public.resolve_commission_push_event(
    OLD.status, NEW.status,
    OLD.current_stage, NEW.current_stage,
    OLD.payment_status, NEW.payment_status,
    OLD.deliverable_path, NEW.deliverable_path);

  IF v_event IS NOT NULL THEN
    PERFORM public.enqueue_push_notification(
      v_event,
      NEW.id,
      CASE WHEN v_event = 'PAYMENT_PROOF_SUBMITTED' THEN NEW.artist_id ELSE NEW.client_id END);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_commission_update failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE TRIGGER commissions_push_on_update
  AFTER UPDATE ON public.commissions
  FOR EACH ROW
  WHEN (   OLD.status           IS DISTINCT FROM NEW.status
        OR OLD.current_stage    IS DISTINCT FROM NEW.current_stage
        OR OLD.payment_status   IS DISTINCT FROM NEW.payment_status
        OR OLD.deliverable_path IS DISTINCT FROM NEW.deliverable_path)
  EXECUTE FUNCTION public.notify_commission_update();

-- 6.3 E5 — nuevo avance con sus imágenes (Spec 006). Una vez por avance.
CREATE OR REPLACE FUNCTION public.notify_advance_files_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT a.commission_id, c.client_id
      FROM new_files f
      JOIN public.commission_advances a ON a.id = f.advance_id
      JOIN public.commissions        c ON c.id = a.commission_id
  LOOP
    PERFORM public.enqueue_push_notification('NEW_ADVANCE', r.commission_id, r.client_id);
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_advance_files_insert failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE TRIGGER commission_advance_files_push_on_insert
  AFTER INSERT ON public.commission_advance_files
  REFERENCING NEW TABLE AS new_files
  FOR EACH STATEMENT EXECUTE FUNCTION public.notify_advance_files_insert();

REVOKE ALL ON FUNCTION public.notify_commission_insert()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_commission_update()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_advance_files_insert() FROM PUBLIC, anon, authenticated;
