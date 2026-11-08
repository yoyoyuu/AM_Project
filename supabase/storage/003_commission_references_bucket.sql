-- ============================================================
-- Spec 003 — Solicitud de comisión
-- T003: bucket commission-references + políticas RLS de Storage
-- ============================================================

-- Crear el bucket privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'commission-references',
  'commission-references',
  false,
  10485760,
  ARRAY['image/jpeg','image/png']
);

-- ============================================================
-- Políticas RLS del bucket
-- La ruta esperada: commission-references/{commission_id}/{filename}
-- ============================================================

-- UPLOAD (INSERT): solo el cliente de la comisión mientras está en PENDIENTE
CREATE POLICY "storage_upload_client"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commission-references'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id::text = (string_to_array(name, '/'))[1]
        AND c.client_id = auth.uid()
        AND c.status = 'PENDIENTE'
    )
  );

-- SELECT: cliente o artista de la comisión pueden obtener una URL firmada
CREATE POLICY "storage_select_parties"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commission-references'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id::text = (string_to_array(name, '/'))[1]
        AND (c.client_id = auth.uid() OR c.artist_id = auth.uid())
    )
  );

-- DELETE: prohibido; las referencias son inmutables tras el envío
-- Sin política DELETE → denegado por defecto con RLS habilitado
