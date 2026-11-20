-- supabase/migrations/011_payments_deliverables.sql
-- Spec 007 — Registro de Pagos, Comprobantes y Entregable Final

-- ═══════════════════════════════════════════════════════════════════
-- 1. ENUM de estado de pago
-- ═══════════════════════════════════════════════════════════════════
CREATE TYPE public.payment_status AS ENUM (
  'UNPAID',            -- Pendiente de pago
  'UNDER_REVIEW',      -- Comprobante en revisión
  'NEEDS_CORRECTION',  -- Requiere corrección
  'VERIFIED'           -- Pagado / Verificado
);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Columnas nuevas en commissions
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.commissions
  ADD COLUMN payment_status            public.payment_status NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN payment_proof_path        text        NULL,
  ADD COLUMN payment_proof_uploaded_at timestamptz NULL,
  ADD COLUMN payment_reference         text        NULL
    CONSTRAINT payment_reference_length CHECK (char_length(payment_reference) <= 60),
  ADD COLUMN payment_note              text        NULL
    CONSTRAINT payment_note_length CHECK (char_length(payment_note) <= 300),
  ADD COLUMN payment_correction_reason text        NULL
    CONSTRAINT payment_correction_reason_length
      CHECK (char_length(payment_correction_reason) BETWEEN 5 AND 300),
  ADD COLUMN paid_verified_at          timestamptz NULL,
  ADD COLUMN deliverable_path          text        NULL,
  ADD COLUMN deliverable_size          integer     NULL
    CONSTRAINT deliverable_size_range CHECK (deliverable_size BETWEEN 1 AND 10485760),
  ADD COLUMN delivered_at              timestamptz NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Invariantes de consistencia (defensa en profundidad)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.commissions
  -- Cualquier estado distinto de UNPAID implica que existe un comprobante
  ADD CONSTRAINT payment_proof_required
    CHECK (payment_status = 'UNPAID' OR payment_proof_path IS NOT NULL),
  -- NEEDS_CORRECTION siempre tiene motivo
  ADD CONSTRAINT payment_correction_reason_required
    CHECK (payment_status <> 'NEEDS_CORRECTION' OR payment_correction_reason IS NOT NULL),
  -- VERIFIED siempre tiene fecha de verificación
  ADD CONSTRAINT paid_verified_at_required
    CHECK (payment_status <> 'VERIFIED' OR paid_verified_at IS NOT NULL),
  -- Ruta, peso y fecha del entregable van juntos
  ADD CONSTRAINT deliverable_fields_consistent
    CHECK (
      (deliverable_path IS NULL AND deliverable_size IS NULL AND delivered_at IS NULL)
      OR (deliverable_path IS NOT NULL AND deliverable_size IS NOT NULL AND delivered_at IS NOT NULL)
    );

-- RF-24-B / RNF-SEG-7.2: nunca COMPLETADA sin pago verificado y entregable.
-- NOT VALID: no revalida filas antiguas de desarrollo (seeds de la Spec 004),
-- pero SÍ se evalúa en todo INSERT/UPDATE a partir de esta migración.
ALTER TABLE public.commissions
  ADD CONSTRAINT completed_requires_payment_and_deliverable
    CHECK (status <> 'COMPLETADA' OR (payment_status = 'VERIFIED' AND deliverable_path IS NOT NULL))
    NOT VALID;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Índice
-- ═══════════════════════════════════════════════════════════════════

-- Panel del artista: comisiones con comprobante por revisar
CREATE INDEX IF NOT EXISTS idx_commissions_artist_payment
  ON public.commissions (artist_id, payment_status)
  WHERE status = 'EN_PROGRESO';

-- ═══════════════════════════════════════════════════════════════════
-- 4. Blindaje de columnas
-- ═══════════════════════════════════════════════════════════════════

-- 4.1 INSERT: el cliente crea la comisión (Spec 003). Un INSERT manipulado
-- no puede nacer con pago verificado ni con entregable.
CREATE OR REPLACE FUNCTION public.commissions_reset_payment_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.payment_status            := 'UNPAID';
  NEW.payment_proof_path        := NULL;
  NEW.payment_proof_uploaded_at := NULL;
  NEW.payment_reference         := NULL;
  NEW.payment_note              := NULL;
  NEW.payment_correction_reason := NULL;
  NEW.paid_verified_at          := NULL;
  NEW.deliverable_path          := NULL;
  NEW.deliverable_size          := NULL;
  NEW.delivered_at              := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER commissions_reset_payment_fields
  BEFORE INSERT ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.commissions_reset_payment_fields();

-- 4.2 UPDATE: privilegios por columna. La política RLS de la Spec 004
-- ("commissions_update_artist_only") sigue decidiendo QUÉ FILAS puede
-- actualizar el artista; los privilegios deciden QUÉ COLUMNAS.
-- Solo las columnas de gestión de la Spec 004 son actualizables directamente;
-- las de pago y entrega solo cambian vía las funciones de la sección 2.3.
REVOKE UPDATE ON public.commissions FROM anon, authenticated;
GRANT  UPDATE (status, current_stage, rejection_reason)
  ON public.commissions TO authenticated;
-- updated_at lo fija el trigger set_updated_at (Spec 004); los triggers
-- no requieren privilegio de columna.

-- ═══════════════════════════════════════════════════════════════════
-- 5. Funciones RPC (única vía para mutar pago y entrega)
-- ═══════════════════════════════════════════════════════════════════

-- ── 5.1 Cliente envía / reenvía comprobante (RF-21-A, RF-20-A) ─────
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_commission_id uuid,
  p_proof_path    text,
  p_reference     text DEFAULT NULL,
  p_note          text DEFAULT NULL
)
RETURNS public.payment_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_c public.commissions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_c FROM public.commissions
   WHERE id = p_commission_id
   FOR UPDATE;

  IF NOT FOUND OR v_c.client_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_c.status <> 'EN_PROGRESO'
     OR v_c.payment_status NOT IN ('UNPAID', 'NEEDS_CORRECTION') THEN
    RAISE EXCEPTION 'invalid_payment_state' USING ERRCODE = 'P0001';
  END IF;

  -- El archivo debe existir, estar en la carpeta de ESTA comisión y ser del cliente
  IF split_part(p_proof_path, '/', 1) <> p_commission_id::text
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects o
        WHERE o.bucket_id = 'payment-proofs'
          AND o.name      = p_proof_path
          AND o.owner_id  = auth.uid()::text
     ) THEN
    RAISE EXCEPTION 'proof_not_found' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.commissions
     SET payment_status            = 'UNDER_REVIEW',
         payment_proof_path        = p_proof_path,
         payment_proof_uploaded_at = now(),
         payment_reference         = NULLIF(btrim(p_reference), ''),
         payment_note              = NULLIF(btrim(p_note), ''),
         payment_correction_reason = NULL
   WHERE id = p_commission_id;

  RETURN 'UNDER_REVIEW';
END;
$$;

-- ── 5.2 Artista confirma el pago (RF-11-B, RF-24-B) ───────────────
CREATE OR REPLACE FUNCTION public.verify_payment(p_commission_id uuid)
RETURNS public.commission_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_c      public.commissions%ROWTYPE;
  v_status public.commission_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_c FROM public.commissions
   WHERE id = p_commission_id
   FOR UPDATE;

  IF NOT FOUND OR v_c.artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_c.status <> 'EN_PROGRESO' OR v_c.payment_status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION 'invalid_payment_state' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.commissions
     SET payment_status            = 'VERIFIED',
         paid_verified_at          = now(),
         payment_correction_reason = NULL,
         -- Cierre automático si el entregable ya existe (RF-24-B)
         status        = CASE WHEN deliverable_path IS NOT NULL
                              THEN 'COMPLETADA'::public.commission_status ELSE status END,
         current_stage = CASE WHEN deliverable_path IS NOT NULL
                              THEN NULL ELSE current_stage END
   WHERE id = p_commission_id
  RETURNING status INTO v_status;

  RETURN v_status;  -- 'EN_PROGRESO' o 'COMPLETADA'
END;
$$;

-- ── 5.3 Artista pide corrección (RF-15-A) ─────────────────────────
CREATE OR REPLACE FUNCTION public.request_payment_correction(
  p_commission_id uuid,
  p_reason        text
)
RETURNS public.payment_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_c      public.commissions%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_reason) < 5 OR char_length(v_reason) > 300 THEN
    RAISE EXCEPTION 'invalid_reason' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_c FROM public.commissions
   WHERE id = p_commission_id
   FOR UPDATE;

  IF NOT FOUND OR v_c.artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_c.status <> 'EN_PROGRESO' OR v_c.payment_status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION 'invalid_payment_state' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.commissions
     SET payment_status            = 'NEEDS_CORRECTION',
         payment_correction_reason = v_reason
   WHERE id = p_commission_id;

  RETURN 'NEEDS_CORRECTION';
END;
$$;

-- ── 5.4 Artista sube / reemplaza el entregable (RF-24-A, RF-24-B) ─
CREATE OR REPLACE FUNCTION public.submit_deliverable(
  p_commission_id    uuid,
  p_deliverable_path text,
  p_file_size        integer
)
RETURNS public.commission_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_c      public.commissions%ROWTYPE;
  v_status public.commission_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_c FROM public.commissions
   WHERE id = p_commission_id
   FOR UPDATE;

  IF NOT FOUND OR v_c.artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_c.status <> 'EN_PROGRESO' OR v_c.current_stage IS DISTINCT FROM 'FINAL' THEN
    RAISE EXCEPTION 'invalid_stage' USING ERRCODE = 'P0001';
  END IF;

  IF p_file_size IS NULL OR p_file_size < 1 OR p_file_size > 10485760 THEN
    RAISE EXCEPTION 'file_too_large' USING ERRCODE = 'P0001';
  END IF;

  IF split_part(p_deliverable_path, '/', 1) <> p_commission_id::text
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects o
        WHERE o.bucket_id = 'commission-deliverables'
          AND o.name      = p_deliverable_path
          AND o.owner_id  = auth.uid()::text
     ) THEN
    RAISE EXCEPTION 'deliverable_not_found' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.commissions
     SET deliverable_path = p_deliverable_path,
         deliverable_size = p_file_size,
         delivered_at     = now(),
         status        = CASE WHEN payment_status = 'VERIFIED'
                              THEN 'COMPLETADA'::public.commission_status ELSE status END,
         current_stage = CASE WHEN payment_status = 'VERIFIED'
                              THEN NULL ELSE current_stage END
   WHERE id = p_commission_id
  RETURNING status INTO v_status;

  RETURN v_status;
END;
$$;

-- ── 5.5 Permisos de ejecución ─────────────────────────────────────
REVOKE ALL ON FUNCTION public.submit_payment_proof(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_payment(uuid)                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_payment_correction(uuid, text)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_deliverable(uuid, text, integer)      FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment(uuid)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payment_correction(uuid, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_deliverable(uuid, text, integer)      TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Buckets privados de Storage
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Comprobantes: siempre JPEG optimizado en el cliente
  ('payment-proofs',          'payment-proofs',          false, 1048576,
     ARRAY['image/jpeg']),
  -- Entregables: calidad de entrega (muy por debajo del máx. de 50 MB del plan gratuito)
  ('commission-deliverables', 'commission-deliverables', false, 10485760,
     ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 7. Políticas RLS en storage.objects — payment-proofs
-- ═══════════════════════════════════════════════════════════════════

-- INSERT: solo el cliente, con la comisión aceptada y el pago esperando comprobante
CREATE POLICY "payment_proofs_insert_client"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
       WHERE c.id = ((storage.foldername(name))[1])::uuid
         AND c.client_id = auth.uid()
         AND c.status = 'EN_PROGRESO'
         AND c.payment_status IN ('UNPAID', 'NEEDS_CORRECTION')
    )
  );

-- SELECT (incluye createSignedUrl y download): artista o cliente de la comisión
CREATE POLICY "payment_proofs_select_parties"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
       WHERE c.id = ((storage.foldername(name))[1])::uuid
         AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- DELETE: solo el dueño del objeto y solo si NO es el comprobante vigente.
-- Permite limpiar huérfanos cuando la RPC falla tras subir el archivo.
CREATE POLICY "payment_proofs_delete_orphans"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND owner_id = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM public.commissions c
       WHERE c.payment_proof_path = storage.objects.name
    )
  );

-- UPDATE: sin política => denegado.

-- ═══════════════════════════════════════════════════════════════════
-- 8. Políticas RLS en storage.objects — commission-deliverables
-- ═══════════════════════════════════════════════════════════════════

-- INSERT: solo el artista, comisión EN_PROGRESO en etapa FINAL
CREATE POLICY "deliverables_insert_artist"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commission-deliverables'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
       WHERE c.id = ((storage.foldername(name))[1])::uuid
         AND c.artist_id = auth.uid()
         AND c.status = 'EN_PROGRESO'
         AND c.current_stage = 'FINAL'
    )
  );

-- SELECT — REGLA RF-12-A:
--   · El artista lee siempre los archivos de su comisión.
--   · El cliente lee ÚNICAMENTE si payment_status = 'VERIFIED'
--     y ÚNICAMENTE el objeto vigente (deliverable_path = name).
CREATE POLICY "deliverables_select_artist_or_paid_client"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commission-deliverables'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
       WHERE c.id = ((storage.foldername(name))[1])::uuid
         AND (
           c.artist_id = auth.uid()
           OR (
             c.client_id        = auth.uid()
             AND c.payment_status   = 'VERIFIED'
             AND c.deliverable_path = storage.objects.name
           )
         )
    )
  );

-- DELETE: el artista dueño del objeto, solo si NO es el entregable vigente
-- (limpieza de huérfanos y de versiones reemplazadas).
CREATE POLICY "deliverables_delete_orphans"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'commission-deliverables'
    AND owner_id = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM public.commissions c
       WHERE c.deliverable_path = storage.objects.name
    )
  );

-- UPDATE: sin política => denegado.
