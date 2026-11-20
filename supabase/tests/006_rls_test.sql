-- Tests RLS: Spec 006 — commission_advances y commission_advance_files
--
-- Prerequisitos: ejecutar con un usuario que tenga permisos de service_role
-- o dentro de una transacción con SET LOCAL. Los UUIDs son ficticios; la base
-- de datos de prueba debe tener datos de fixture que los satisfagan.
--
-- Convenciones:
--   commission-uuid-1  → comisión EN_PROGRESO, artist_id = artist-uuid-1, client_id = client-uuid-1
--   commission-uuid-2  → comisión PENDIENTE,   artist_id = artist-uuid-1
--   artist-uuid-1      → artista propietario de ambas comisiones
--   artist-uuid-2      → artista ajeno
--   client-uuid-1      → cliente de commission-uuid-1
--   stranger-uuid      → usuario sin relación con ninguna comisión

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.1: artista puede insertar avance en su comisión EN_PROGRESO
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: 1 fila insertada (sin error de RLS)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
INSERT INTO public.commission_advances (commission_id, artist_id, stage, note)
VALUES ('commission-uuid-1', 'artist-uuid-1', 'SKETCH', 'Boceto inicial listo');

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.2: artista NO puede insertar avance en comisión ajena
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: error de RLS (violación de política o 0 filas)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-2","role":"authenticated"}';
INSERT INTO public.commission_advances (commission_id, artist_id, stage, note)
VALUES ('commission-uuid-1', 'artist-uuid-2', 'SKETCH', null);

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.3: artista NO puede insertar avance en comisión que no está EN_PROGRESO
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: error de RLS (status != 'EN_PROGRESO')
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
INSERT INTO public.commission_advances (commission_id, artist_id, stage)
VALUES ('commission-uuid-2', 'artist-uuid-1', 'SKETCH');

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.4: artista puede leer sus propios avances
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: filas propias del artista (> 0 si T2.1 se ejecutó antes)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
SELECT * FROM public.commission_advances WHERE commission_id = 'commission-uuid-1';

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.5: cliente puede leer avances de su comisión
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: filas de la comisión donde client_id = 'client-uuid-1'
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
SELECT * FROM public.commission_advances WHERE commission_id = 'commission-uuid-1';

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.6: tercero NO puede leer avances de comisión ajena
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: 0 filas
SET LOCAL request.jwt.claims = '{"sub":"stranger-uuid","role":"authenticated"}';
SELECT * FROM public.commission_advances WHERE commission_id = 'commission-uuid-1';

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.7: nadie puede hacer UPDATE en un avance
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: 0 filas actualizadas (sin política UPDATE; RLS deniega por defecto)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
UPDATE public.commission_advances SET note = 'nota modificada' WHERE commission_id = 'commission-uuid-1';

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.8: nadie puede hacer DELETE en un avance (vía cliente autenticado)
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: 0 filas eliminadas (sin política DELETE; RLS deniega por defecto)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
DELETE FROM public.commission_advances WHERE commission_id = 'commission-uuid-1';

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.9: nota > 300 caracteres falla por CHECK constraint
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: error de CHECK constraint (advance_note_length)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
INSERT INTO public.commission_advances (commission_id, artist_id, stage, note)
VALUES ('commission-uuid-1', 'artist-uuid-1', 'SKETCH', repeat('x', 301));

-- ─────────────────────────────────────────────────────────────────────────────
-- T2.10: archivo huérfano falla por FK constraint
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: error de FK constraint (advance_id no existe en commission_advances)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
INSERT INTO public.commission_advance_files (advance_id, storage_path, file_size, sort_order)
VALUES ('00000000-0000-0000-0000-000000000000', 'some/path.webp', 1024, 0);
