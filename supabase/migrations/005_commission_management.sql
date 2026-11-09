-- ============================================================
-- Spec 004 — Gestión de comisión
-- T041: tipos ENUM commission_status y creative_stage
-- T042: migrar columna status + columnas de gestión
-- T043: actualizar políticas RLS para gestión del artista
-- ============================================================

-- ============================================================
-- T041 — Tipos ENUM
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.commission_status AS ENUM (
    'PENDIENTE',
    'EN_PROGRESO',
    'RECHAZADA',
    'COMPLETADA',
    'CANCELADA',
    'EN_REVISION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.creative_stage AS ENUM (
    'SKETCH',
    'LINEART',
    'FINAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- T042 — Migrar columna status + columnas de gestión
-- ============================================================

-- 0. Eliminar políticas de storage.objects que referencian commissions.status
--    (Postgres no permite alterar una columna usada en una política de otra tabla)
DROP POLICY IF EXISTS "storage_upload_client" ON storage.objects;

-- 1. Eliminar el CHECK de texto ANTES de cambiar el tipo
--    (Postgres revalida los CHECK al hacer ALTER COLUMN TYPE; el CHECK compara
--     con literales text y falla si el tipo ya es ENUM)
ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_status_check;

-- 2. Convertir status de text a ENUM
ALTER TABLE public.commissions
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.commissions
  ALTER COLUMN status TYPE public.commission_status
  USING status::public.commission_status;

ALTER TABLE public.commissions
  ALTER COLUMN status SET DEFAULT 'PENDIENTE'::public.commission_status;

-- 3. Agregar columnas de gestión
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS current_stage    public.creative_stage NULL;
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS rejection_reason text NULL
    CONSTRAINT rejection_reason_length CHECK (char_length(rejection_reason) <= 500);
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- 4. Índice en updated_at para ordenar eficientemente
CREATE INDEX IF NOT EXISTS idx_commissions_updated_at ON public.commissions (updated_at DESC);

-- 5. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commissions_set_updated_at ON public.commissions;
CREATE TRIGGER commissions_set_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Recrear la política de storage que fue dropeada en el paso 0
--    Ahora status es commission_status ENUM; cast explícito requerido.
DROP POLICY IF EXISTS "storage_upload_client" ON storage.objects;
CREATE POLICY "storage_upload_client"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commission-references'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id::text = (string_to_array(name, '/'))[1]
        AND c.client_id = auth.uid()
        AND c.status = 'PENDIENTE'::public.commission_status
    )
  );

-- ============================================================
-- T043 — Actualizar políticas RLS para gestión del artista
-- ============================================================

-- 1. Eliminar la política de UPDATE genérica de la migración 003
DROP POLICY IF EXISTS "commissions_update_artist" ON public.commissions;

-- 2. Política de UPDATE refinada: solo el artista propietario puede actualizar
--    WITH CHECK también verifica artist_id y client_id para prevenir que se
--    modifiquen esas columnas en un UPDATE.
DROP POLICY IF EXISTS "commissions_update_artist_only" ON public.commissions;
CREATE POLICY "commissions_update_artist_only"
  ON public.commissions FOR UPDATE
  TO authenticated
  USING  (auth.uid() = artist_id)
  WITH CHECK (
    auth.uid() = artist_id
    AND artist_id = artist_id
    AND client_id = client_id
  );

-- Las políticas INSERT y SELECT de la migración 003 no requieren cambios:
--   INSERT "commissions_insert_client"  — solo el cliente puede crear (sin cambios)
--   SELECT "commissions_select_parties" — cliente o artista pueden leer (sin cambios)
--   DELETE — denegado por defecto con RLS (sin cambios)
