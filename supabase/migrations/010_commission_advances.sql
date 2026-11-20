-- Migration 010: commission_advances tables, bucket and RLS policies
-- Spec 006 — Subida y Visualización de Avances

-- ── Tablas ───────────────────────────────────────────────────────────────────

CREATE TABLE public.commission_advances (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid        NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  artist_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  stage         public.creative_stage NOT NULL,
  note          text        NULL
    CONSTRAINT advance_note_length CHECK (char_length(note) <= 300),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.commission_advance_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id   uuid        NOT NULL REFERENCES public.commission_advances(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  file_size    integer     NOT NULL
    CONSTRAINT advance_file_size_positive CHECK (file_size > 0),
  sort_order   smallint    NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_commission_advances_commission_id
  ON public.commission_advances (commission_id, created_at DESC);

CREATE INDEX idx_advance_files_advance_id
  ON public.commission_advance_files (advance_id, sort_order);

-- ── Bucket de Storage ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'commission-advances',
  'commission-advances',
  false,
  307200,
  ARRAY['image/webp', 'image/jpeg', 'image/png']
);

-- ── RLS en tablas ─────────────────────────────────────────────────────────────

ALTER TABLE public.commission_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_advance_files ENABLE ROW LEVEL SECURITY;

-- commission_advances: INSERT solo el artista propietario de una comisión EN_PROGRESO
CREATE POLICY "advances_insert_artist"
  ON public.commission_advances FOR INSERT
  TO authenticated
  WITH CHECK (
    artist_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = commission_id
        AND c.artist_id = auth.uid()
        AND c.status = 'EN_PROGRESO'
    )
  );

-- commission_advances: SELECT artista o cliente de la comisión
CREATE POLICY "advances_select_parties"
  ON public.commission_advances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = commission_id
        AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- commission_advance_files: INSERT solo el artista propietario (vía el avance)
CREATE POLICY "advance_files_insert_artist"
  ON public.commission_advance_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commission_advances a
        JOIN public.commissions c ON c.id = a.commission_id
      WHERE a.id = advance_id
        AND c.artist_id = auth.uid()
    )
  );

-- commission_advance_files: SELECT artista o cliente de la comisión
CREATE POLICY "advance_files_select_parties"
  ON public.commission_advance_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commission_advances a
        JOIN public.commissions c ON c.id = a.commission_id
      WHERE a.id = advance_id
        AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- ── RLS en storage.objects ────────────────────────────────────────────────────

-- INSERT en Storage: solo el artista propietario de la comisión EN_PROGRESO
CREATE POLICY "advance_files_insert_artist"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commission-advances'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = (string_to_array(name, '/'))[1]::uuid
        AND c.artist_id = auth.uid()
        AND c.status = 'EN_PROGRESO'
    )
  );

-- SELECT en Storage: artista o cliente de la comisión
CREATE POLICY "advance_files_select_parties"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commission-advances'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = (string_to_array(name, '/'))[1]::uuid
        AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
    )
  );
