# Plan 007 — Registro de Pagos, Comprobantes y Entregable Final (`007-pagos-entregable`)

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-20
**Derivado de:** `007-pagos-entregable/spec.md`
**Constitución:** v1.1

> Este documento describe **cómo** se implementa la spec 007. Toda decisión técnica se deriva de los RF y RNF de la spec. Las APIs de Expo citadas deben verificarse contra la documentación de SDK 58 antes de implementar (constitución, sección 3).

---

## 1. Visión general del flujo técnico

```
Cliente (React Native / Expo)
  │
  └─ [Screen] CommissionTrackingDetailScreen (Spec 005)
        └─ <ClientPaymentPanel>  +  <ClientDeliverablePanel>
              │
              ├─ Subir comprobante
              │    1. Explicación + permiso de galería (expo-image-picker)
              │    2. Seleccionar 1 imagen → validar tipo/tamaño (≤ 10 MB)
              │    3. Optimizar (expo-image-manipulator → JPEG, ≤ 1600 px, ≤ 1 MB)
              │    4. Upload → bucket privado "payment-proofs"   (RLS INSERT)
              │    5. RPC submit_payment_proof()                 (SECURITY DEFINER)
              │    6. Si 5 falla → borrar objeto de 4             (RLS DELETE solo huérfanos)
              │    7. invalidateQueries(['commissions'])
              │
              └─ Guardar en galería (solo si payment_status = VERIFIED)
                   1. Explicación + permiso de escritura (expo-media-library)
                   2. createSignedUrl(deliverable_path, 60 s)    (RLS SELECT ⇒ bloqueo real)
                   3. File.downloadFileAsync → caché (expo-file-system)
                   4. MediaLibrary.saveToLibraryAsync
                   5. Borrar archivo temporal

Artista (React Native / Expo)
  │
  └─ [Screen] CommissionWorkScreen (Spec 004)
        └─ <ArtistPaymentPanel>  +  <ArtistDeliverablePanel>
              ├─ Ver comprobante (signed URL 300 s)
              ├─ RPC verify_payment()                    → VERIFIED (+ COMPLETADA si hay entregable)
              ├─ RPC request_payment_correction(reason)  → NEEDS_CORRECTION
              └─ Subir entregable final (etapa FINAL)
                   1. Permiso de galería → 1 imagen
                   2. Conservar original si ≤ 10 MB y ≤ 4096 px; si no, redimensionar
                   3. Upload → bucket privado "commission-deliverables"
                   4. RPC submit_deliverable()            → (+ COMPLETADA si VERIFIED)
                   5. Si 4 falla → borrar objeto; si 4 ok y había anterior → borrar anterior

Backend (Supabase)
  ├─ ENUM payment_status
  ├─ Columnas nuevas en commissions + CHECKs de consistencia
  ├─ Privilegios por columna: el UPDATE directo NO puede tocar columnas de pago/entrega
  ├─ 3 funciones RPC SECURITY DEFINER (única vía para mutar pago y entrega)
  ├─ Buckets privados payment-proofs (1 MB) y commission-deliverables (10 MB)
  └─ Políticas RLS en storage.objects (INSERT / SELECT / DELETE de huérfanos)
```

---

## 2. Esquema de base de datos

### 2.1 Decisión: columnas en `commissions` vs. tabla dedicada

Se agregan columnas a `public.commissions` en lugar de crear una tabla `commission_payments`:

- La relación es **1:1** (un pago y un entregable vigentes por comisión, P-7.1 y P-7.7).
- La regla de bloqueo y el cierre automático necesitan leer `status`, `payment_status` y `deliverable_path` **en la misma fila**: un `CHECK` de tabla puede garantizar «no hay `COMPLETADA` sin pago y entregable» sin triggers entre tablas.
- Las políticas de Storage hacen un solo `EXISTS` sobre `commissions`, igual que en la Spec 006.
- Las queries de las specs 004 y 005 ya cargan la comisión; agregar columnas evita un JOIN más (Principio 11).

No se guarda historial de comprobantes devueltos (solo el vigente). Si en el futuro se requiere auditoría, se agrega una tabla de eventos sin romper este esquema.

### 2.2 Migración

```sql
-- supabase/migrations/007_payments_deliverables.sql

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
```

### 2.3 Funciones RPC (única vía para mutar pago y entrega)

Todas son `SECURITY DEFINER` (se ejecutan como el dueño de la tabla, saltando RLS) y por eso **validan explícitamente** identidad (`auth.uid()`), rol en la comisión y estado. Bloquean la fila con `FOR UPDATE` para evitar carreras (por ejemplo, el cliente reenvía mientras el artista confirma). Los errores se lanzan con un código de texto estable que la app traduce a los mensajes literales de la spec (sección 4.6).

```sql
-- ── 2.3.1 Cliente envía / reenvía comprobante (RF-21-A, RF-20-A) ─────
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

-- ── 2.3.2 Artista confirma el pago (RF-11-B, RF-24-B) ───────────────
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

-- ── 2.3.3 Artista pide corrección (RF-15-A) ─────────────────────────
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

-- ── 2.3.4 Artista sube / reemplaza el entregable (RF-24-A, RF-24-B) ─
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

-- ── 2.3.5 Permisos de ejecución ─────────────────────────────────────
REVOKE ALL ON FUNCTION public.submit_payment_proof(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_payment(uuid)                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_payment_correction(uuid, text)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_deliverable(uuid, text, integer)      FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment(uuid)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payment_correction(uuid, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_deliverable(uuid, text, integer)      TO authenticated;
```

### 2.4 Índice

```sql
-- Panel del artista: comisiones con comprobante por revisar
CREATE INDEX IF NOT EXISTS idx_commissions_artist_payment
  ON public.commissions (artist_id, payment_status)
  WHERE status = 'EN_PROGRESO';
```

### 2.5 Vista resultante de las columnas nuevas

```
commissions (columnas agregadas por 007)
──────────────────────────────────────────────────────────────────────────
 payment_status            payment_status NOT NULL DEFAULT 'UNPAID'
 payment_proof_path        text NULL         -- {commission_id}/{proof_id}.jpg
 payment_proof_uploaded_at timestamptz NULL
 payment_reference         text NULL         CHECK ≤ 60
 payment_note              text NULL         CHECK ≤ 300
 payment_correction_reason text NULL         CHECK 5..300; requerido si NEEDS_CORRECTION
 paid_verified_at          timestamptz NULL  requerido si VERIFIED
 deliverable_path          text NULL         -- {commission_id}/final-{id}.{jpg|png|webp}
 deliverable_size          integer NULL      CHECK 1..10485760
 delivered_at              timestamptz NULL
 CHECK completed_requires_payment_and_deliverable
```

### 2.6 Matriz de quién cambia qué

| Columna | INSERT (cliente, Spec 003) | UPDATE directo (artista, Spec 004) | RPC |
|---|---|---|---|
| `status`, `current_stage` | Valor de Spec 003 | Sí (RLS: solo artista) — pero el `CHECK` impide `COMPLETADA` sin pago + entregable | `verify_payment`, `submit_deliverable` (cierre) |
| `rejection_reason` | — | Sí | — |
| Columnas `payment_*`, `paid_verified_at` | Forzadas a valores iniciales por trigger | **No** (sin privilegio de columna) | `submit_payment_proof`, `verify_payment`, `request_payment_correction` |
| Columnas `deliverable_*`, `delivered_at` | Forzadas a NULL por trigger | **No** | `submit_deliverable` |

---

## 3. Buckets de Storage y políticas RLS

### 3.1 Creación de buckets

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Comprobantes: siempre JPEG optimizado en el cliente
  ('payment-proofs',          'payment-proofs',          false, 1048576,
     ARRAY['image/jpeg']),
  -- Entregables: calidad de entrega (Principio 2: muy por debajo del máx. de 50 MB del plan gratuito)
  ('commission-deliverables', 'commission-deliverables', false, 10485760,
     ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
```

### 3.2 Convención de rutas

```
payment-proofs/
  {commission_id}/
    {proof_id}.jpg              ← un objeto por intento; el vigente es commissions.payment_proof_path

commission-deliverables/
  {commission_id}/
    final-{deliverable_id}.{jpg|png|webp}   ← el vigente es commissions.deliverable_path
```

`proof_id` / `deliverable_id` se generan en la app (`Date.now().toString(36)` + sufijo aleatorio). Se suben con `upsert: false`: nunca se sobrescribe un objeto existente (no hay política UPDATE).

### 3.3 Políticas en `storage.objects` — `payment-proofs`

```sql
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

-- UPDATE: sin política ⇒ denegado.
```

### 3.4 Políticas en `storage.objects` — `commission-deliverables` (bloqueo crítico)

```sql
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

-- SELECT — ESTA ES LA REGLA RF-12-A:
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

-- UPDATE: sin política ⇒ denegado.
```

### 3.5 Por qué el bloqueo es real (y no solo de UI)

1. El bucket es **privado** (`public = false`): no existen URLs públicas; `getPublicUrl()` devuelve una URL que responde 400/404.
2. `createSignedUrl()`, `createSignedUrls()` y `download()` en Supabase Storage **evalúan la política SELECT de `storage.objects` con el JWT del usuario** antes de firmar o servir el objeto. Si la política no devuelve la fila, la API responde error (`Object not found` / 400) y **no emite firma**.
3. La política SELECT del cliente exige `c.payment_status = 'VERIFIED'` leído **en el momento de la petición** desde `commissions`; el cliente no puede alterar ese valor porque (a) no tiene privilegio de columna `UPDATE` y (b) las RPC no le permiten llegar a `VERIFIED`.
4. Una URL firmada emitida al artista no sirve al cliente para «adelantarse»: el artista nunca comparte esa URL desde la app, y su vida útil es corta (preview 10 min). El enlace de descarga del cliente se genera con 60 s de vida (RNF-SEG-7.3).
5. Las versiones reemplazadas quedan fuera por `c.deliverable_path = storage.objects.name`.
6. La subconsulta sobre `commissions` se evalúa con el RLS de `commissions` (Spec 003/005): un tercero ni siquiera ve la fila.

### 3.6 Pruebas RLS y de funciones

```sql
-- supabase/tests/007_rls_test.sql
-- Fixtures (como postgres/service_role, antes de las pruebas):
--   commission-uuid-1 : client-uuid-1 / artist-uuid-1, EN_PROGRESO, stage FINAL, UNPAID
--   commission-uuid-2 : client-uuid-1 / artist-uuid-1, PENDIENTE
--   proof object      : payment-proofs/commission-uuid-1/p1.jpg  (owner_id = client-uuid-1)
--   deliverable obj   : commission-deliverables/commission-uuid-1/final-d1.png (owner_id = artist-uuid-1)

BEGIN;
SET LOCAL ROLE authenticated;

-- ── Integridad del estado de pago ──────────────────────────────────

-- P1: el cliente NO puede actualizar payment_status directamente
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
UPDATE public.commissions SET payment_status = 'VERIFIED' WHERE id = 'commission-uuid-1';
-- Esperado: ERROR permission denied for table commissions (privilegio de columna)

-- P2: el artista tampoco puede actualizar payment_status directamente
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
UPDATE public.commissions SET payment_status = 'VERIFIED' WHERE id = 'commission-uuid-1';
-- Esperado: ERROR permission denied (debe usar verify_payment)

-- P3: el artista NO puede poner COMPLETADA sin pago ni entregable
UPDATE public.commissions SET status = 'COMPLETADA', current_stage = NULL WHERE id = 'commission-uuid-1';
-- Esperado: ERROR violates check constraint "completed_requires_payment_and_deliverable"

-- P4: un INSERT manipulado no nace verificado
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
INSERT INTO public.commissions (client_id, artist_id, service_id, description, intended_use, payment_status)
VALUES ('client-uuid-1', 'artist-uuid-1', 'service-uuid-1', repeat('d', 30), 'personal', 'VERIFIED')
RETURNING payment_status;
-- Esperado: 'UNPAID' (trigger), o ERROR de privilegio si 003 restringe columnas de INSERT

-- ── submit_payment_proof ───────────────────────────────────────────

-- P5: el cliente envía comprobante válido → UNDER_REVIEW
SELECT public.submit_payment_proof('commission-uuid-1', 'commission-uuid-1/p1.jpg', 'ABC123', NULL);
-- Esperado: 'UNDER_REVIEW'

-- P6: reenviar estando UNDER_REVIEW → invalid_payment_state
SELECT public.submit_payment_proof('commission-uuid-1', 'commission-uuid-1/p1.jpg');
-- Esperado: ERROR invalid_payment_state

-- P7: el artista no puede enviar comprobante
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
SELECT public.submit_payment_proof('commission-uuid-1', 'commission-uuid-1/p1.jpg');
-- Esperado: ERROR forbidden

-- P8: comprobante en comisión PENDIENTE → invalid_payment_state
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
SELECT public.submit_payment_proof('commission-uuid-2', 'commission-uuid-2/x.jpg');
-- Esperado: ERROR invalid_payment_state

-- P9: ruta de otra comisión → proof_not_found
SELECT public.submit_payment_proof('commission-uuid-1', 'commission-uuid-2/x.jpg');
-- Esperado: ERROR (invalid_payment_state si ya está en revisión; si UNPAID: proof_not_found)

-- ── request_payment_correction / verify_payment ────────────────────

-- P10: el cliente no puede pedir corrección ni verificar
SELECT public.request_payment_correction('commission-uuid-1', 'Comprobante ilegible');
-- Esperado: ERROR forbidden
SELECT public.verify_payment('commission-uuid-1');
-- Esperado: ERROR forbidden

-- P11: motivo vacío o corto → invalid_reason
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
SELECT public.request_payment_correction('commission-uuid-1', '   ab ');
-- Esperado: ERROR invalid_reason

-- P12: motivo válido → NEEDS_CORRECTION con motivo guardado
SELECT public.request_payment_correction('commission-uuid-1', 'Comprobante ilegible');
-- Esperado: 'NEEDS_CORRECTION'

-- P13: verificar estando NEEDS_CORRECTION → invalid_payment_state
SELECT public.verify_payment('commission-uuid-1');
-- Esperado: ERROR invalid_payment_state

-- ── Bloqueo del entregable (Storage) ───────────────────────────────

-- P14: con pago ≠ VERIFIED, el cliente NO ve el objeto del entregable
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
SELECT name FROM storage.objects
 WHERE bucket_id = 'commission-deliverables' AND name LIKE 'commission-uuid-1/%';
-- Esperado: 0 filas  ⇒ createSignedUrl/download fallan para el cliente

-- P15: el artista SÍ ve el objeto del entregable
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
SELECT name FROM storage.objects
 WHERE bucket_id = 'commission-deliverables' AND name LIKE 'commission-uuid-1/%';
-- Esperado: ≥ 1 fila

-- P16: (preparación como postgres: payment_status = 'VERIFIED',
--       deliverable_path = 'commission-uuid-1/final-d1.png')
--      el cliente ya ve SOLO el objeto vigente
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
SELECT name FROM storage.objects
 WHERE bucket_id = 'commission-deliverables' AND name LIKE 'commission-uuid-1/%';
-- Esperado: exactamente 'commission-uuid-1/final-d1.png'

-- P17: un tercero no ve comprobantes ni entregables
SET LOCAL request.jwt.claims = '{"sub":"stranger-uuid","role":"authenticated"}';
SELECT name FROM storage.objects
 WHERE bucket_id IN ('payment-proofs', 'commission-deliverables');
-- Esperado: 0 filas

-- P18: el cliente NO puede subir al bucket de entregables
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES ('commission-deliverables', 'commission-uuid-1/final-x.png', 'client-uuid-1');
-- Esperado: ERROR new row violates row-level security policy

-- P19: el artista NO puede subir entregable si la etapa no es FINAL
--      (fixture commission-uuid-3 en LINEART)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES ('commission-deliverables', 'commission-uuid-3/final-x.png', 'artist-uuid-1');
-- Esperado: ERROR RLS

-- P20: nadie puede borrar el comprobante o entregable VIGENTE
DELETE FROM storage.objects
 WHERE bucket_id = 'commission-deliverables' AND name = 'commission-uuid-1/final-d1.png';
-- Esperado: 0 filas borradas

-- ── submit_deliverable y cierre automático ─────────────────────────

-- P21: con VERIFIED, submit_deliverable cierra la comisión
SELECT public.submit_deliverable('commission-uuid-1', 'commission-uuid-1/final-d1.png', 2048000);
-- Esperado: 'COMPLETADA'; current_stage IS NULL

-- P22: tamaño > 10 MB → file_too_large
SELECT public.submit_deliverable('commission-uuid-4', 'commission-uuid-4/final-z.png', 10485761);
-- Esperado: ERROR file_too_large (o invalid_stage según fixture)

ROLLBACK;
```

> Las pruebas de Storage sobre `storage.objects` reproducen exactamente la evaluación que hace la API al firmar URLs. Además, la tarea T024 documenta un caso manual con la app/SDK que verifica que `createSignedUrl` falla para el cliente antes de `VERIFIED`.

---

## 4. Pipeline técnico en la app

### 4.1 Configuración nativa (`app.json`)

```json
{
  "expo": {
    "plugins": [
      ["expo-image-picker", {
        "photosPermission": "Koma necesita acceso a tu galería para que puedas adjuntar imágenes a tus comisiones.",
        "cameraPermission": false
      }],
      ["expo-media-library", {
        "savePhotosPermission": "Koma necesita permiso para guardar la ilustración final en la galería de tu dispositivo.",
        "isAccessMediaLocationEnabled": false,
        "granularPermissions": ["photo"]
      }]
    ]
  }
}
```

- `isAccessMediaLocationEnabled: false`: no se necesita ubicación de las fotos (Principio 8, LFPDPPP).
- `granularPermissions: ["photo"]`: en Android 13+ solo se pide acceso a imágenes (no audio/video).
- Verificar en la documentación de SDK 58 las claves exactas del config plugin antes de construir el development build.

### 4.2 Tipos de dominio

```typescript
// src/features/pagos/types.ts
import type { CommissionStatus, CreativeStage } from '@/features/gestion/types';

export type PaymentStatus = 'UNPAID' | 'UNDER_REVIEW' | 'NEEDS_CORRECTION' | 'VERIFIED';

export interface CommissionPayment {
  id: string;
  client_id: string;
  artist_id: string;
  status: CommissionStatus;
  current_stage: CreativeStage | null;
  base_price: number;
  payment_status: PaymentStatus;
  payment_proof_path: string | null;
  payment_proof_uploaded_at: string | null;
  payment_reference: string | null;
  payment_note: string | null;
  payment_correction_reason: string | null;
  paid_verified_at: string | null;
  deliverable_path: string | null;
  deliverable_size: number | null;
  delivered_at: string | null;
}

export type PaymentRpcErrorCode =
  | 'not_authenticated'
  | 'forbidden'
  | 'invalid_payment_state'
  | 'invalid_reason'
  | 'invalid_stage'
  | 'file_too_large'
  | 'proof_not_found'
  | 'deliverable_not_found';
```

```typescript
// src/features/gestion/types.ts  (MODIFICAR — Spec 004)
// Agregar a la interfaz Commission:
//   payment_status: PaymentStatus;
//   deliverable_path: string | null;
//   delivered_at: string | null;
// importando PaymentStatus desde '@/features/pagos/types' (solo tipo).
```

### 4.3 Reglas puras (presenters)

```typescript
// src/features/pagos/presenters.ts
import type { CommissionPayment, PaymentStatus } from './types';

export interface PaymentBadgeConfig {
  label: string;
  colorKey: 'warning' | 'info' | 'error' | 'success';
}

const PAYMENT_BADGES: Record<PaymentStatus, PaymentBadgeConfig> = {
  UNPAID:           { label: 'Pendiente de pago',        colorKey: 'warning' },
  UNDER_REVIEW:     { label: 'Comprobante en revisión',  colorKey: 'info'    },
  NEEDS_CORRECTION: { label: 'Requiere corrección',      colorKey: 'error'   },
  VERIFIED:         { label: 'Pagado',                   colorKey: 'success' },
};

export const getPaymentBadge = (s: PaymentStatus): PaymentBadgeConfig => PAYMENT_BADGES[s];

export function canClientSubmitProof(p: Pick<CommissionPayment, 'status' | 'payment_status'>): boolean {
  return p.status === 'EN_PROGRESO'
    && (p.payment_status === 'UNPAID' || p.payment_status === 'NEEDS_CORRECTION');
}

export function canArtistReviewPayment(p: Pick<CommissionPayment, 'status' | 'payment_status'>): boolean {
  return p.status === 'EN_PROGRESO' && p.payment_status === 'UNDER_REVIEW';
}

export const CLIENT_PAYMENT_MESSAGES: Record<PaymentStatus, string> = {
  UNPAID:           'Aún no has enviado tu comprobante de pago',
  UNDER_REVIEW:     'Tu comprobante está en revisión por el artista',
  NEEDS_CORRECTION: 'El artista pidió corregir tu comprobante',
  VERIFIED:         'Pago verificado por el artista',
};

export const ARTIST_PAYMENT_MESSAGES: Record<PaymentStatus, string> = {
  UNPAID:           'El cliente aún no ha enviado su comprobante de pago',
  UNDER_REVIEW:     'Revisa el comprobante del cliente',
  NEEDS_CORRECTION: 'Pediste al cliente corregir su comprobante',
  VERIFIED:         'Pago confirmado',
};

export const CORRECTION_SUGGESTIONS = [
  'Comprobante ilegible',
  'Monto incompleto',
  'No se recibió el depósito',
  'Los datos no coinciden con mi cuenta',
] as const;
```

```typescript
// src/features/entregables/presenters.ts
import type { CommissionPayment } from '@/features/pagos/types';

export type ClientDeliverableView = 'NOT_UPLOADED' | 'LOCKED' | 'UNLOCKED';

/** Tabla de RF-12-A. La UI es un reflejo; el bloqueo real está en Storage RLS. */
export function getClientDeliverableView(
  p: Pick<CommissionPayment, 'payment_status' | 'deliverable_path'>,
): ClientDeliverableView {
  if (p.deliverable_path === null) return 'NOT_UPLOADED';
  return p.payment_status === 'VERIFIED' ? 'UNLOCKED' : 'LOCKED';
}

export function canArtistUploadDeliverable(
  p: Pick<CommissionPayment, 'status' | 'current_stage'>,
): boolean {
  return p.status === 'EN_PROGRESO' && p.current_stage === 'FINAL';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

### 4.4 Cambio en la máquina de estados de la Spec 004

```typescript
// src/features/gestion/stateMachine.ts  (MODIFICAR)
case 'ADVANCE_STAGE': {
  if (currentStatus !== 'EN_PROGRESO') {
    throw new Error('Esta comisión ya no está en progreso');
  }
  if (currentStage === null) {
    throw new Error('Debes completar la etapa actual antes de avanzar');
  }
  const currentIndex = CREATIVE_STAGE_ORDER.indexOf(currentStage);
  const isLastStage = currentIndex === CREATIVE_STAGE_ORDER.length - 1;

  if (isLastStage) {
    // Spec 007, RF-24-B: el cierre ya no es manual; ocurre en las RPC
    // verify_payment / submit_deliverable cuando hay pago VERIFIED + entregable.
    throw new Error('Sube el entregable final para cerrar la comisión');
  }
  return { newStatus: 'EN_PROGRESO', newStage: CREATIVE_STAGE_ORDER[currentIndex + 1] };
}
```

`CommissionWorkScreen` oculta «Completar etapa» cuando `current_stage === 'FINAL'` y muestra `<ArtistDeliverablePanel>`.

### 4.5 Esquemas Zod (React Hook Form)

```typescript
// src/features/pagos/schemas.ts
import { z } from 'zod';

export const paymentProofSchema = z.object({
  reference: z
    .string()
    .trim()
    .max(60, 'La referencia no puede superar los 60 caracteres')
    .optional()
    .or(z.literal('')),
  note: z
    .string()
    .trim()
    .max(300, 'La nota no puede superar los 300 caracteres')
    .optional()
    .or(z.literal('')),
});
export type PaymentProofFormValues = z.infer<typeof paymentProofSchema>;

export const paymentCorrectionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Indica el motivo de la corrección (mínimo 5 caracteres)')
    .max(300, 'El motivo no puede superar los 300 caracteres'),
});
export type PaymentCorrectionFormValues = z.infer<typeof paymentCorrectionSchema>;
```

Uso: `useForm<PaymentProofFormValues>({ resolver: zodResolver(paymentProofSchema), defaultValues: { reference: '', note: '' } })`. Las sugerencias de corrección llaman a `setValue('reason', suggestion, { shouldValidate: true })`.

### 4.6 Traducción de errores RPC a mensajes literales

```typescript
// src/features/pagos/errors.ts
import type { PostgrestError } from '@supabase/supabase-js';
import type { PaymentRpcErrorCode } from './types';

export type PaymentAction = 'SUBMIT_PROOF' | 'VERIFY' | 'REQUEST_CORRECTION' | 'SUBMIT_DELIVERABLE';

const FALLBACK: Record<PaymentAction, string> = {
  SUBMIT_PROOF:       'No se pudo subir el comprobante, inténtalo de nuevo',
  VERIFY:             'No se pudo actualizar el estado del pago',
  REQUEST_CORRECTION: 'No se pudo procesar la devolución del comprobante',
  SUBMIT_DELIVERABLE: 'No se pudo subir el entregable. Comprueba tu conexión e inténtalo de nuevo',
};

const BY_CODE: Partial<Record<PaymentRpcErrorCode, Partial<Record<PaymentAction, string>>>> = {
  invalid_payment_state: {
    SUBMIT_PROOF:       'No puedes subir un comprobante en este momento',
    VERIFY:             'Este comprobante ya no está en revisión',
    REQUEST_CORRECTION: 'Este comprobante ya no está en revisión',
  },
  invalid_reason: {
    REQUEST_CORRECTION: 'Indica el motivo de la corrección (mínimo 5 caracteres)',
  },
  invalid_stage: {
    SUBMIT_DELIVERABLE: 'Solo puedes subir el entregable final en la etapa Color / Acabado final',
  },
  file_too_large: {
    SUBMIT_DELIVERABLE: 'El archivo supera el tamaño máximo de 10 MB incluso después de optimizarlo',
  },
};

export class PaymentError extends Error {
  constructor(message: string, readonly code?: PaymentRpcErrorCode) {
    super(message);
  }
}

export function toPaymentError(action: PaymentAction, error: PostgrestError | Error | null): PaymentError {
  const raw = error?.message ?? '';
  const code = raw as PaymentRpcErrorCode;
  return new PaymentError(BY_CODE[code]?.[action] ?? FALLBACK[action], BY_CODE[code] ? code : undefined);
}
```

### 4.7 Selección de imagen y permisos de galería (lectura)

Se reutiliza `requestGalleryPermission()` de la Spec 006 (`src/features/avances/utils/requestGalleryPermission.ts`). Se agrega una utilidad genérica de selección única:

```typescript
// src/lib/media/pickSingleImage.ts
import * as ImagePicker from 'expo-image-picker';

export interface PickedAsset {
  uri: string;
  width: number;
  height: number;
  fileSize: number | null;   // bytes, si Android lo reporta
  mimeType: string | null;
}

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

/** Abre la galería para elegir UNA imagen. Devuelve null si el usuario cancela. */
export async function pickSingleImage(): Promise<PickedAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    allowsEditing: false,
    quality: 1,      // sin recompresión del picker
    exif: false,     // privacidad: sin metadatos
  });
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    width: a.width,
    height: a.height,
    fileSize: a.fileSize ?? null,
    mimeType: a.mimeType ?? null,
  };
}

export function isAllowedSource(asset: PickedAsset): boolean {
  const mimeOk = asset.mimeType !== null
    && (ALLOWED_IMAGE_MIME as readonly string[]).includes(asset.mimeType);
  const sizeOk = asset.fileSize === null || asset.fileSize <= MAX_SOURCE_BYTES;
  return mimeOk && sizeOk;
}
```

Flujo del botón: (1) diálogo propio con el mensaje de la sección 7 de la spec → (2) `requestGalleryPermission()` → si `granted: false`, toast «No se puede acceder a la galería…» y se queda en pantalla → (3) `pickSingleImage()` → (4) `isAllowedSource()`; si falla, «Formato o tamaño no permitido» (comprobante) o «Formato no permitido. Usa una imagen JPG, PNG o WEBP» (entregable).

### 4.8 Optimización del comprobante (legibilidad > peso)

```typescript
// src/features/pagos/utils/compressPaymentProof.ts
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

const MAX_SIDE = 1600;           // suficiente para leer folios y montos en capturas
const QUALITY_STEPS = [0.8, 0.65] as const;
const MAX_BYTES = 1024 * 1024;   // = file_size_limit del bucket payment-proofs

export interface CompressedProof { uri: string; size: number; }

export async function compressPaymentProof(uri: string, width: number, height: number): Promise<CompressedProof> {
  for (const compress of QUALITY_STEPS) {
    const ctx = ImageManipulator.manipulate(uri);
    if (Math.max(width, height) > MAX_SIDE) {
      ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ compress, format: SaveFormat.JPEG });
    const size = new File(saved.uri).size ?? 0;
    if (size > 0 && size <= MAX_BYTES) return { uri: saved.uri, size };
  }
  throw new Error('proof_too_large'); // se muestra «Formato o tamaño no permitido»
}
```

> Se usa la API contextual `ImageManipulator.manipulate()` (la recomendada desde SDK 52; `manipulateAsync` está obsoleta). La Spec 006 usa `manipulateAsync`; se recomienda alinear en una tarea de mantenimiento aparte, fuera de esta spec.

### 4.9 Preparación del entregable (calidad de entrega)

```typescript
// src/features/entregables/utils/prepareDeliverableImage.ts
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import type { PickedAsset } from '@/lib/media/pickSingleImage';

export const DELIVERABLE_MAX_BYTES = 10 * 1024 * 1024;
export const DELIVERABLE_MAX_SIDE  = 4096;

export interface PreparedDeliverable {
  uri: string;
  size: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

export async function prepareDeliverableImage(asset: PickedAsset): Promise<PreparedDeliverable> {
  const mime = asset.mimeType as keyof typeof EXT;
  if (!(mime in EXT)) throw new Error('unsupported_format');

  const originalSize = asset.fileSize ?? new File(asset.uri).size ?? 0;
  const fitsSide = Math.max(asset.width, asset.height) <= DELIVERABLE_MAX_SIDE;

  // 1) Caso normal: se sube el ORIGINAL, sin recompresión (RF-24-A)
  if (fitsSide && originalSize > 0 && originalSize <= DELIVERABLE_MAX_BYTES) {
    return { uri: asset.uri, size: originalSize, mimeType: mime, extension: EXT[mime] };
  }

  // 2) Excede: reducir a 4096 px. PNG intenta conservar PNG (transparencia);
  //    si sigue > 10 MB, cae a JPEG 0.92.
  const attempts: Array<{ format: SaveFormat; mime: PreparedDeliverable['mimeType']; compress: number }> =
    mime === 'image/png'
      ? [{ format: SaveFormat.PNG,  mime: 'image/png',  compress: 1 },
         { format: SaveFormat.JPEG, mime: 'image/jpeg', compress: 0.92 }]
      : [{ format: SaveFormat.JPEG, mime: 'image/jpeg', compress: 0.92 }];

  for (const a of attempts) {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (!fitsSide) {
      ctx.resize(asset.width >= asset.height
        ? { width: DELIVERABLE_MAX_SIDE }
        : { height: DELIVERABLE_MAX_SIDE });
    }
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ compress: a.compress, format: a.format });
    const size = new File(saved.uri).size ?? 0;
    if (size > 0 && size <= DELIVERABLE_MAX_BYTES) {
      return { uri: saved.uri, size, mimeType: a.mime, extension: EXT[a.mime] };
    }
  }
  throw new Error('file_too_large');
}
```

### 4.10 Subida a Storage (utilidad común)

```typescript
// src/lib/storage/uploadLocalFile.ts
import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';

export function newObjectId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sube un archivo local como ArrayBuffer (más fiable en React Native que fetch().blob(),
 * que puede producir objetos de 0 bytes). upsert: false ⇒ nunca sobrescribe.
 */
export async function uploadLocalFile(bucket: string, path: string, uri: string, contentType: string) {
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
}

export async function removeQuietly(bucket: string, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]).catch(() => undefined);
}
```

### 4.11 Hooks con TanStack Query

**Claves y estrategia de caché**

```typescript
// src/features/pagos/hooks/useCommissionPayment.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CommissionPayment } from '../types';

export const commissionPaymentQueryKey = (commissionId: string) =>
  ['commissions', 'payment', commissionId] as const;

export function useCommissionPayment(commissionId: string) {
  return useQuery({
    queryKey: commissionPaymentQueryKey(commissionId),
    queryFn: async (): Promise<CommissionPayment> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          id, client_id, artist_id, status, current_stage,
          payment_status, payment_proof_path, payment_proof_uploaded_at,
          payment_reference, payment_note, payment_correction_reason, paid_verified_at,
          deliverable_path, deliverable_size, delivered_at,
          service:services!service_id (base_price)
        `)
        .eq('id', commissionId)
        .single<Omit<CommissionPayment, 'base_price'> & { service: { base_price: number } | null }>();
      if (error) throw error;
      const { service, ...rest } = data;
      return { ...rest, base_price: service?.base_price ?? 0 };
    },
    staleTime: 1000 * 15,  // el pago cambia por acción de la otra parte; revalida al enfocar
  });
}
```

Todas las mutaciones de esta spec invalidan el prefijo `['commissions']` en `onSettled` (éxito **o** error de estado). Esto refresca a la vez: pago (`['commissions','payment',id]`), detalle del artista (Spec 004 `['commissions','detail',id]`), detalle y lista del cliente (Spec 005 `['commissions','client',…]`) y pendientes del artista. TanStack Query solo re-ejecuta las queries **montadas**, por lo que el costo es bajo y se evita olvidar una clave (DT-7.7).

**Enviar comprobante**

```typescript
// src/features/pagos/hooks/useSubmitPaymentProof.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { newObjectId, removeQuietly, uploadLocalFile } from '@/lib/storage/uploadLocalFile';
import { compressPaymentProof } from '../utils/compressPaymentProof';
import { toPaymentError } from '../errors';
import type { PickedAsset } from '@/lib/media/pickSingleImage';

interface Payload {
  commissionId: string;
  asset: PickedAsset;
  reference?: string;
  note?: string;
}

const BUCKET = 'payment-proofs';

export function useSubmitPaymentProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commissionId, asset, reference, note }: Payload) => {
      const proof = await compressPaymentProof(asset.uri, asset.width, asset.height);
      const path = `${commissionId}/${newObjectId()}.jpg`;

      try {
        await uploadLocalFile(BUCKET, path, proof.uri, 'image/jpeg');
      } catch (e) {
        throw toPaymentError('SUBMIT_PROOF', e as Error);
      }

      const { error } = await supabase.rpc('submit_payment_proof', {
        p_commission_id: commissionId,
        p_proof_path: path,
        p_reference: reference?.trim() || null,
        p_note: note?.trim() || null,
      });
      if (error) {
        await removeQuietly(BUCKET, path);   // RLS DELETE permite borrar el huérfano
        throw toPaymentError('SUBMIT_PROOF', error);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}
```

**Confirmar pago / pedir corrección**

> En los fragmentos siguientes se omiten los `import` repetidos: son los mismos de `useSubmitPaymentProof.ts` más `CommissionStatus` (`@/features/gestion/types`), `PaymentError` (`@/features/pagos/errors`), `prepareDeliverableImage` / `PreparedDeliverable` y las utilidades de `@/lib/storage/uploadLocalFile`.

```typescript
// src/features/pagos/hooks/useVerifyPayment.ts
export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commissionId: string): Promise<CommissionStatus> => {
      const { data, error } = await supabase.rpc('verify_payment', { p_commission_id: commissionId });
      if (error) throw toPaymentError('VERIFY', error);
      return data as CommissionStatus; // 'EN_PROGRESO' ⇒ «Pago confirmado»; 'COMPLETADA' ⇒ mensaje de cierre
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}

// src/features/pagos/hooks/useRequestPaymentCorrection.ts
export function useRequestPaymentCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commissionId, reason }: { commissionId: string; reason: string }) => {
      const { error } = await supabase.rpc('request_payment_correction', {
        p_commission_id: commissionId,
        p_reason: reason.trim(),
      });
      if (error) throw toPaymentError('REQUEST_CORRECTION', error);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}
```

**URL del comprobante (ver en pantalla completa)**

```typescript
// src/features/pagos/hooks/usePaymentProofUrl.ts
export function usePaymentProofUrl(path: string | null) {
  return useQuery({
    queryKey: ['commissions', 'payment-proof-url', path],
    enabled: path !== null,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(path as string, 300); // RNF-SEG-7.3
      if (error) throw new Error('No se pudo cargar el comprobante. Inténtalo de nuevo');
      return data.signedUrl;
    },
    staleTime: 1000 * 60 * 4, // se renueva antes de expirar
    gcTime: 1000 * 60 * 5,
  });
}
```

**Subir entregable**

```typescript
// src/features/entregables/hooks/useSubmitDeliverable.ts
const BUCKET = 'commission-deliverables';

export function useSubmitDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { commissionId: string; asset: PickedAsset; previousPath: string | null })
      : Promise<CommissionStatus> => {
      let prepared: PreparedDeliverable;
      try {
        prepared = await prepareDeliverableImage(p.asset);
      } catch (e) {
        const msg = (e as Error).message === 'unsupported_format'
          ? 'Formato no permitido. Usa una imagen JPG, PNG o WEBP'
          : 'El archivo supera el tamaño máximo de 10 MB incluso después de optimizarlo';
        throw new PaymentError(msg);
      }

      const path = `${p.commissionId}/final-${newObjectId()}.${prepared.extension}`;
      try {
        await uploadLocalFile(BUCKET, path, prepared.uri, prepared.mimeType);
      } catch (e) {
        throw toPaymentError('SUBMIT_DELIVERABLE', e as Error);
      }

      const { data, error } = await supabase.rpc('submit_deliverable', {
        p_commission_id: p.commissionId,
        p_deliverable_path: path,
        p_file_size: prepared.size,
      });
      if (error) {
        await removeQuietly(BUCKET, path);
        throw toPaymentError('SUBMIT_DELIVERABLE', error);
      }
      // Versión reemplazada: ya no es vigente ⇒ la política DELETE permite borrarla
      if (p.previousPath) await removeQuietly(BUCKET, p.previousPath);
      return data as CommissionStatus;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}
```

**Vista previa del entregable desbloqueado**

```typescript
// src/features/entregables/hooks/useDeliverablePreviewUrl.ts
export function useDeliverablePreviewUrl(path: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['commissions', 'deliverable-url', path],
    enabled: enabled && path !== null,      // cliente: solo si VERIFIED; artista: siempre
    retry: false,                           // un rechazo de RLS no se reintenta
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('commission-deliverables')
        .createSignedUrl(path as string, 600);
      if (error) throw new Error('La descarga se habilitará cuando el pago esté liquidado');
      return data.signedUrl;
    },
    staleTime: 1000 * 60 * 9,
    gcTime: 1000 * 60 * 10,
  });
}
```

### 4.12 Descarga y guardado en galería (RF-12-B)

```typescript
// src/features/entregables/utils/requestMediaLibraryWritePermission.ts
import * as MediaLibrary from 'expo-media-library';

export type WritePermissionResult = { granted: true } | { granted: false; canAskAgain: boolean };

/** Solo escritura (writeOnly = true): no pide leer toda la galería del cliente. */
export async function requestMediaLibraryWritePermission(): Promise<WritePermissionResult> {
  const current = await MediaLibrary.getPermissionsAsync(true);
  if (current.granted) return { granted: true };
  if (!current.canAskAgain) return { granted: false, canAskAgain: false };
  const res = await MediaLibrary.requestPermissionsAsync(true);
  return res.granted ? { granted: true } : { granted: false, canAskAgain: res.canAskAgain };
}
```

```typescript
// src/features/entregables/utils/saveDeliverableToGallery.ts
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '@/lib/supabase';

export type SaveErrorCode = 'locked' | 'network' | 'no_space' | 'unknown';

export class SaveDeliverableError extends Error {
  constructor(readonly code: SaveErrorCode) { super(code); }
}

const SIGNED_URL_TTL_S = 60; // RNF-SEG-7.3

export async function saveDeliverableToGallery(deliverablePath: string, commissionId: string): Promise<void> {
  // 1) Enlace temporal. Si el pago no es VERIFIED, Storage RLS lo rechaza AQUÍ.
  const { data, error } = await supabase.storage
    .from('commission-deliverables')
    .createSignedUrl(deliverablePath, SIGNED_URL_TTL_S);
  if (error || !data) throw new SaveDeliverableError('locked');

  // 2) Descarga a la caché de la app (no requiere permisos)
  const ext = deliverablePath.split('.').pop() ?? 'jpg';
  const target = new File(Paths.cache, `koma-${commissionId}.${ext}`);
  if (target.exists) target.delete();

  let downloaded: File;
  try {
    downloaded = await File.downloadFileAsync(data.signedUrl, target);
  } catch (e) {
    if (target.exists) target.delete();
    const msg = String((e as Error).message).toLowerCase();
    throw new SaveDeliverableError(msg.includes('space') ? 'no_space' : 'network');
  }

  // 3) Guardar en la galería y 4) limpiar siempre el temporal
  try {
    await MediaLibrary.saveToLibraryAsync(downloaded.uri);
  } catch (e) {
    const msg = String((e as Error).message).toLowerCase();
    throw new SaveDeliverableError(msg.includes('space') ? 'no_space' : 'unknown');
  } finally {
    if (downloaded.exists) downloaded.delete();
  }
}
```

```typescript
// src/features/entregables/hooks/useSaveDeliverable.ts
import { useMutation } from '@tanstack/react-query';
import { Linking } from 'react-native';

export const SAVE_MESSAGES = {
  success:  'Ilustración guardada en tu galería',
  denied:   'No se pudo guardar porque no diste permiso de acceso a tu galería. Puedes habilitarlo en los ajustes de tu dispositivo',
  locked:   'La descarga se habilitará cuando el pago esté liquidado',
  network:  'No se pudo descargar el entregable. Comprueba tu conexión e inténtalo de nuevo',
  no_space: 'No hay espacio suficiente en tu dispositivo para guardar el archivo',
  unknown:  'No se pudo descargar el entregable. Comprueba tu conexión e inténtalo de nuevo',
} as const;

export type SaveOutcome = { ok: true } | { ok: false; message: string; showOpenSettings: boolean };

export function useSaveDeliverable() {
  return useMutation({
    mutationFn: async (p: { commissionId: string; deliverablePath: string }): Promise<SaveOutcome> => {
      const perm = await requestMediaLibraryWritePermission();
      if (!perm.granted) return { ok: false, message: SAVE_MESSAGES.denied, showOpenSettings: true };
      try {
        await saveDeliverableToGallery(p.deliverablePath, p.commissionId);
        return { ok: true };
      } catch (e) {
        const code = e instanceof SaveDeliverableError ? e.code : 'unknown';
        return { ok: false, message: SAVE_MESSAGES[code], showOpenSettings: false };
      }
    },
  });
}

export const openAppSettings = () => Linking.openSettings();
```

El componente muestra primero un diálogo propio con «Koma necesita permiso para guardar la ilustración final en la galería de tu dispositivo.» **solo si** `getPermissionsAsync(true)` no está concedido; luego llama a la mutación. Mientras `isPending`, el botón muestra «Guardando…» y queda deshabilitado.

> **Android ≥ 10 (API 29+):** con `writeOnly = true`, `saveToLibraryAsync` inserta vía MediaStore sin `WRITE_EXTERNAL_STORAGE`. En Android 13+ el config plugin limita el permiso a fotos (`granularPermissions: ["photo"]`). Verificar en la documentación de `expo-media-library` de SDK 58 si existe una API nueva preferida para guardar.

---

## 5. Estructura de archivos

```
src/lib/
├── media/
│   └── pickSingleImage.ts                 # NUEVO — selector de una imagen + validación de origen
└── storage/
    └── uploadLocalFile.ts                 # NUEVO — upload ArrayBuffer, ids, borrado silencioso

src/features/pagos/
├── components/
│   ├── PaymentStatusBadge.tsx             # Badge de estado de pago
│   ├── ClientPaymentPanel.tsx             # Sección «Pago y entrega» (cliente): estado, aviso, botón
│   ├── SubmitPaymentProofSheet.tsx        # Bottom sheet: vista previa + referencia + nota (RHF+Zod)
│   ├── ArtistPaymentPanel.tsx             # Sección «Pago y entrega» (artista): comprobante + acciones
│   ├── PaymentProofViewer.tsx             # Pantalla completa con zoom del comprobante
│   ├── ConfirmPaymentDialog.tsx           # Diálogo irreversible de confirmación
│   └── RequestCorrectionSheet.tsx         # Formulario de motivo + sugerencias (RHF+Zod)
├── hooks/
│   ├── useCommissionPayment.ts
│   ├── useSubmitPaymentProof.ts
│   ├── useVerifyPayment.ts
│   ├── useRequestPaymentCorrection.ts
│   └── usePaymentProofUrl.ts
├── utils/
│   └── compressPaymentProof.ts
├── __tests__/
│   ├── presenters.test.ts
│   ├── schemas.test.ts
│   ├── errors.test.ts
│   └── useSubmitPaymentProof.test.ts
├── errors.ts
├── presenters.ts
├── schemas.ts
└── types.ts

src/features/entregables/
├── components/
│   ├── ArtistDeliverablePanel.tsx         # Subir / reemplazar / ver entregable (etapa FINAL)
│   ├── ClientDeliverablePanel.tsx         # NOT_UPLOADED / LOCKED / UNLOCKED
│   ├── DeliverableLockedCard.tsx          # Tarjeta con candado
│   └── SaveToGalleryButton.tsx            # Botón + diálogo de permiso + «Abrir ajustes»
├── hooks/
│   ├── useSubmitDeliverable.ts
│   ├── useDeliverablePreviewUrl.ts
│   └── useSaveDeliverable.ts
├── utils/
│   ├── prepareDeliverableImage.ts
│   ├── requestMediaLibraryWritePermission.ts
│   └── saveDeliverableToGallery.ts
├── __tests__/
│   ├── presenters.test.ts
│   ├── prepareDeliverableImage.test.ts
│   ├── saveDeliverableToGallery.test.ts
│   └── useSaveDeliverable.test.ts
└── presenters.ts

MODIFICADOS
├── app.json                                              # config plugins (4.1)
├── src/features/gestion/types.ts                         # campos de pago en Commission
├── src/features/gestion/stateMachine.ts                  # FINAL ya no cierra (4.4)
├── src/features/gestion/__tests__/stateMachine.test.ts   # caso FINAL actualizado
├── src/features/gestion/screens/CommissionWorkScreen.tsx # paneles del artista
├── src/features/seguimiento/types.ts                     # payment_status en summary/detail
├── src/features/seguimiento/hooks/useMyCommissions.ts    # select payment_status
├── src/features/seguimiento/components/CommissionCard.tsx# badge de pago en «En curso»
└── src/features/seguimiento/screens/CommissionTrackingDetailScreen.tsx # paneles del cliente

supabase/
├── migrations/
│   └── 007_payments_deliverables.sql      # ENUM, columnas, CHECKs, trigger, privilegios, RPC, buckets, RLS
└── tests/
    └── 007_rls_test.sql                   # Pruebas de la sección 3.6
```

> Nota de consistencia: la Spec 006 (tarea T016) nombra la pantalla del cliente `CommissionDetailScreen.tsx` dentro de `seguimiento/`, mientras que el plan 005 la nombra `CommissionTrackingDetailScreen.tsx`. Esta spec usa el nombre del plan 005; si en el repositorio existe el otro nombre, se modifica ese archivo.

---

## 6. Consideraciones de rendimiento y cuota gratuita

| Recurso | Consideración |
|---|---|
| Storage (1 GB en plan gratuito) | Comprobante ≤ 1 MB; entregable ≤ 10 MB. Peor caso por comisión ≈ 10 MB + (n.º de reenvíos × 1 MB). Con 1 GB caben ≈ 90 comisiones en el peor caso; el caso típico (ilustración de 2–4 MB) supera las 200. Se monitorea desde el dashboard. |
| Límite por archivo (50 MB en plan gratuito) | Los límites de bucket (1 MB y 10 MB) quedan muy por debajo. |
| Egress (5 GB/mes en plan gratuito) | Cada guardado del cliente descarga el entregable completo. La vista previa usa el mismo archivo; se mantiene en caché de `expo-image` mientras la URL es válida (10 min). |
| Huérfanos | Las políticas DELETE permiten a la app borrar el archivo si la RPC falla y la versión reemplazada del entregable. Los comprobantes devueltos se conservan como evidencia (≤ 1 MB c/u). |
| Concurrencia | `SELECT … FOR UPDATE` en las RPC serializa acciones simultáneas de artista y cliente sobre la misma comisión. |
| `staleTime` | 15 s para el pago (cambia por acción de la otra parte); revalidación al enfocar (comportamiento por defecto, igual que Spec 005). Las push de la Spec 008 dispararán invalidaciones. |

---

## 7. Decisiones técnicas

| ID | Tema | Decisión |
|---|---|---|
| DT-7.1 | Columnas vs. tabla | Columnas en `commissions` (sección 2.1): relación 1:1 y `CHECK` en una sola fila. |
| DT-7.2 | Mutaciones de pago vía RPC | Funciones `SECURITY DEFINER` con validación explícita de `auth.uid()`, rol y estado, y `FOR UPDATE`. Evita abrir `UPDATE` de `commissions` al cliente (Spec 004 lo prohíbe) y concentra la máquina de estados en un solo lugar del servidor. |
| DT-7.3 | Privilegios por columna | `GRANT UPDATE (status, current_stage, rejection_reason)` en lugar de un trigger de guarda: el motor rechaza cualquier intento de tocar columnas de pago, sin lógica adicional. Compatible con `useCommissionAction` de la Spec 004 (solo envía esas columnas). |
| DT-7.4 | Cierre automático en servidor | El `CHECK completed_requires_payment_and_deliverable` (NOT VALID para datos previos) más las RPC garantizan RNF-SEG-7.2 aun si se manipula la app. |
| DT-7.5 | Bloqueo en Storage RLS | La política SELECT de `commission-deliverables` es la única barrera que importa para RF-12; la UI solo la refleja. |
| DT-7.6 | Subir primero, registrar después | La ruta se genera en la app; el archivo se sube y luego la RPC valida que el objeto existe y pertenece al usuario. Si la RPC falla, el objeto se borra (política DELETE de huérfanos). |
| DT-7.7 | Invalidación por prefijo `['commissions']` | Simple y a prueba de olvidos; solo re-ejecuta queries montadas. |
| DT-7.8 | Comprobante en JPEG 1600 px | El JPEG conserva bien el texto de capturas; 1600 px mantiene legibles folios y montos con ≤ 1 MB. |
| DT-7.9 | Entregable sin recompresión cuando cabe | Respeta la calidad del artista; solo se reduce si excede 10 MB o 4096 px. |
| DT-7.10 | Upload como `ArrayBuffer` | `new File(uri).arrayBuffer()` (expo-file-system) evita objetos de 0 bytes de `fetch().blob()` en RN. |
| DT-7.11 | Permiso de escritura `writeOnly` | El cliente no concede lectura de toda su galería solo para guardar una imagen (Principio 8). |
| DT-7.12 | Vida de URLs firmadas | Descarga 60 s; vista previa del entregable 10 min; comprobante 5 min (contiene datos financieros). |
| DT-7.13 | Sin Edge Functions | Todo se resuelve con Postgres (RPC + RLS) y Storage (Principio 11, cuota gratuita). |
