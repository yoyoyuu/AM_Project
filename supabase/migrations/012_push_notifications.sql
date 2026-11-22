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
