-- ============================================================
-- Spec 003 — Solicitud de comisión
-- T001: tabla commissions + RLS
-- T002: tabla commission_references + RLS
-- ============================================================

-- ============================================================
-- T001 — tabla `commissions`
-- ============================================================

CREATE TABLE public.commissions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  artist_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  service_id        uuid        NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  status            text        NOT NULL DEFAULT 'PENDIENTE'
                                  CHECK (status IN (
                                    'PENDIENTE','ACEPTADA','RECHAZADA',
                                    'EN_PROGRESO','EN_REVISION','COMPLETADA','CANCELADA'
                                  )),
  description       text        NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  pose              text        CHECK (char_length(pose) <= 500),
  key_elements      text        CHECK (char_length(key_elements) <= 500),
  intended_use      text        NOT NULL CHECK (intended_use IN ('personal','comercial')),
  additional_notes  text        CHECK (char_length(additional_notes) <= 500),
  terms_accepted_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT client_ne_artist CHECK (client_id <> artist_id)
);

CREATE INDEX idx_commissions_client_id ON public.commissions (client_id);
CREATE INDEX idx_commissions_artist_id ON public.commissions (artist_id);
CREATE INDEX idx_commissions_status    ON public.commissions (status);

-- RLS
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- INSERT: solo el cliente autenticado puede crear comisiones para sí mismo
CREATE POLICY "commissions_insert_client"
  ON public.commissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

-- SELECT: el cliente o el artista de la comisión puede leerla
CREATE POLICY "commissions_select_parties"
  ON public.commissions FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = artist_id);

-- UPDATE: solo el artista puede cambiar el estado
CREATE POLICY "commissions_update_artist"
  ON public.commissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = artist_id)
  WITH CHECK (auth.uid() = artist_id);

-- DELETE: prohibido; sin política DELETE → denegado por defecto con RLS habilitado

-- ============================================================
-- T002 — tabla `commission_references`
-- ============================================================

CREATE TABLE public.commission_references (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid    NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  storage_path  text    NOT NULL,
  file_size     integer NOT NULL CHECK (file_size > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_refs_commission_id ON public.commission_references (commission_id);

-- RLS
ALTER TABLE public.commission_references ENABLE ROW LEVEL SECURITY;

-- INSERT: el cliente de la comisión puede insertar referencias
CREATE POLICY "refs_insert_client"
  ON public.commission_references FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = commission_id
        AND c.client_id = auth.uid()
    )
  );

-- SELECT: cliente o artista de la comisión pueden ver las referencias
CREATE POLICY "refs_select_parties"
  ON public.commission_references FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = commission_id
        AND (c.client_id = auth.uid() OR c.artist_id = auth.uid())
    )
  );

-- DELETE: prohibido por UI en esta versión; sin política DELETE → denegado por defecto
