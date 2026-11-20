-- Tests RLS auto-contenidos: Spec 006 — commission_advances
--
-- Ejecutar completo en el SQL Editor de Supabase (service_role).
-- Los resultados aparecen en la pestaña "Results" como filas PASS/FAIL.
-- Toda la ejecución ocurre dentro de una transacción que hace ROLLBACK
-- al final → no deja datos en la base de datos.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
--  Tabla de resultados (dentro de la transacción; visible antes del ROLLBACK)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TEMP TABLE rls_results (test_id text, status text, detail text);
GRANT ALL ON rls_results TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  FIXTURE SETUP (service_role — sin restricciones RLS)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_user_meta_data)
VALUES
  ('a1000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'artist1@rls.test', '', now(), now(), now(),
   '{"privacy_accepted":"true","privacy_notice_version":"v1"}'),
  ('a2000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'artist2@rls.test', '', now(), now(), now(),
   '{"privacy_accepted":"true","privacy_notice_version":"v1"}'),
  ('c1000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'client1@rls.test', '', now(), now(), now(),
   '{"privacy_accepted":"true","privacy_notice_version":"v1"}'),
  ('ee000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'stranger@rls.test', '', now(), now(), now(),
   '{"privacy_accepted":"true","privacy_notice_version":"v1"}');

UPDATE public.profiles SET display_name = 'Artista Uno', handle = 'artista-uno-rls'
  WHERE id = 'a1000000-0000-0000-0000-000000000000';
UPDATE public.profiles SET display_name = 'Artista Dos', handle = 'artista-dos-rls'
  WHERE id = 'a2000000-0000-0000-0000-000000000000';
UPDATE public.profiles SET display_name = 'Cliente Uno'
  WHERE id = 'c1000000-0000-0000-0000-000000000000';
UPDATE public.profiles SET display_name = 'Stranger'
  WHERE id = 'ee000000-0000-0000-0000-000000000000';

INSERT INTO public.services (id, artist_id, title, price_mxn, delivery_days)
VALUES ('f1000000-0000-0000-0000-000000000000',
        'a1000000-0000-0000-0000-000000000000',
        'Ilustración de prueba RLS', 500, 7);

INSERT INTO public.commissions
  (id, client_id, artist_id, service_id, status, current_stage, description, intended_use)
VALUES
  ('d1000000-0000-0000-0000-000000000000',
   'c1000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000000',
   'f1000000-0000-0000-0000-000000000000',
   'EN_PROGRESO', 'SKETCH',
   'Descripción de prueba que supera los veinte caracteres requeridos.', 'personal'),
  ('d2000000-0000-0000-0000-000000000000',
   'c1000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000000',
   'f1000000-0000-0000-0000-000000000000',
   'PENDIENTE', NULL,
   'Descripción de prueba que supera los veinte caracteres requeridos.', 'personal');

-- ═══════════════════════════════════════════════════════════════════════════
--  TESTS RLS (authenticated)
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL role = authenticated;

-- ── T2.1: artista inserta avance en comisión propia EN_PROGRESO ─────────────
DO $$
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000000","role":"authenticated"}';
  BEGIN
    INSERT INTO public.commission_advances (commission_id, artist_id, stage, note)
    VALUES ('d1000000-0000-0000-0000-000000000000',
            'a1000000-0000-0000-0000-000000000000', 'SKETCH', 'Boceto inicial listo');
    INSERT INTO rls_results VALUES ('T2.1', 'PASS', 'artista insertó avance en comisión EN_PROGRESO');
  EXCEPTION
    WHEN others THEN
      INSERT INTO rls_results VALUES ('T2.1', 'FAIL', 'Error inesperado: ' || SQLERRM);
  END;
END $$;

-- ── T2.2: artista ajeno no puede insertar ───────────────────────────────────
DO $$
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000000","role":"authenticated"}';
  BEGIN
    INSERT INTO public.commission_advances (commission_id, artist_id, stage)
    VALUES ('d1000000-0000-0000-0000-000000000000',
            'a2000000-0000-0000-0000-000000000000', 'SKETCH');
    INSERT INTO rls_results VALUES ('T2.2', 'FAIL', 'Se esperaba bloqueo de RLS pero la inserción tuvo éxito');
  EXCEPTION
    WHEN insufficient_privilege THEN
      INSERT INTO rls_results VALUES ('T2.2', 'PASS', 'RLS bloqueó inserción por artista ajeno');
    WHEN others THEN
      INSERT INTO rls_results VALUES ('T2.2', 'FAIL', 'Error inesperado: ' || SQLERRM);
  END;
END $$;

-- ── T2.3: artista no puede insertar en comisión que no está EN_PROGRESO ─────
DO $$
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000000","role":"authenticated"}';
  BEGIN
    INSERT INTO public.commission_advances (commission_id, artist_id, stage)
    VALUES ('d2000000-0000-0000-0000-000000000000',
            'a1000000-0000-0000-0000-000000000000', 'SKETCH');
    INSERT INTO rls_results VALUES ('T2.3', 'FAIL', 'Se esperaba bloqueo de RLS pero la inserción tuvo éxito');
  EXCEPTION
    WHEN insufficient_privilege THEN
      INSERT INTO rls_results VALUES ('T2.3', 'PASS', 'RLS bloqueó inserción en comisión PENDIENTE');
    WHEN others THEN
      INSERT INTO rls_results VALUES ('T2.3', 'FAIL', 'Error inesperado: ' || SQLERRM);
  END;
END $$;

-- ── T2.4: artista puede leer sus propios avances ────────────────────────────
DO $$
DECLARE v_count integer;
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000000","role":"authenticated"}';
  SELECT COUNT(*) INTO v_count
  FROM public.commission_advances
  WHERE commission_id = 'd1000000-0000-0000-0000-000000000000';
  IF v_count > 0 THEN
    INSERT INTO rls_results VALUES ('T2.4', 'PASS', 'artista ve ' || v_count || ' avance(s) propios');
  ELSE
    INSERT INTO rls_results VALUES ('T2.4', 'FAIL', 'artista no ve ningún avance (esperaba > 0)');
  END IF;
END $$;

-- ── T2.5: cliente puede leer avances de su comisión ─────────────────────────
DO $$
DECLARE v_count integer;
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000000","role":"authenticated"}';
  SELECT COUNT(*) INTO v_count
  FROM public.commission_advances
  WHERE commission_id = 'd1000000-0000-0000-0000-000000000000';
  IF v_count > 0 THEN
    INSERT INTO rls_results VALUES ('T2.5', 'PASS', 'cliente ve ' || v_count || ' avance(s) de su comisión');
  ELSE
    INSERT INTO rls_results VALUES ('T2.5', 'FAIL', 'cliente no ve ningún avance (esperaba > 0)');
  END IF;
END $$;

-- ── T2.6: tercero no puede leer avances de comisión ajena ───────────────────
DO $$
DECLARE v_count integer;
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"ee000000-0000-0000-0000-000000000000","role":"authenticated"}';
  SELECT COUNT(*) INTO v_count
  FROM public.commission_advances
  WHERE commission_id = 'd1000000-0000-0000-0000-000000000000';
  IF v_count = 0 THEN
    INSERT INTO rls_results VALUES ('T2.6', 'PASS', 'tercero ve 0 avances (RLS correcto)');
  ELSE
    INSERT INTO rls_results VALUES ('T2.6', 'FAIL', 'tercero vio ' || v_count || ' avance(s) (esperaba 0)');
  END IF;
END $$;

-- ── T2.7: nadie puede hacer UPDATE en un avance ─────────────────────────────
DO $$
DECLARE v_count integer;
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000000","role":"authenticated"}';
  UPDATE public.commission_advances
    SET note = 'nota modificada'
    WHERE commission_id = 'd1000000-0000-0000-0000-000000000000';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    INSERT INTO rls_results VALUES ('T2.7', 'PASS', 'UPDATE bloqueado por RLS (0 filas afectadas)');
  ELSE
    INSERT INTO rls_results VALUES ('T2.7', 'FAIL', 'UPDATE modificó ' || v_count || ' fila(s) (esperaba 0)');
  END IF;
END $$;

-- ── T2.8: nadie puede hacer DELETE en un avance ─────────────────────────────
DO $$
DECLARE v_count integer;
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000000","role":"authenticated"}';
  DELETE FROM public.commission_advances
    WHERE commission_id = 'd1000000-0000-0000-0000-000000000000';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    INSERT INTO rls_results VALUES ('T2.8', 'PASS', 'DELETE bloqueado por RLS (0 filas afectadas)');
  ELSE
    INSERT INTO rls_results VALUES ('T2.8', 'FAIL', 'DELETE eliminó ' || v_count || ' fila(s) (esperaba 0)');
  END IF;
END $$;

-- ── T2.9: nota > 300 caracteres falla por CHECK constraint ──────────────────
DO $$
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000000","role":"authenticated"}';
  BEGIN
    INSERT INTO public.commission_advances (commission_id, artist_id, stage, note)
    VALUES ('d1000000-0000-0000-0000-000000000000',
            'a1000000-0000-0000-0000-000000000000', 'SKETCH', repeat('x', 301));
    INSERT INTO rls_results VALUES ('T2.9', 'FAIL', 'Se esperaba CHECK violation pero la inserción tuvo éxito');
  EXCEPTION
    WHEN check_violation THEN
      INSERT INTO rls_results VALUES ('T2.9', 'PASS', 'CHECK bloqueó nota de 301 caracteres');
    WHEN others THEN
      INSERT INTO rls_results VALUES ('T2.9', 'FAIL', 'Error inesperado: ' || SQLERRM);
  END;
END $$;

-- ── T2.10: archivo huérfano falla por FK / RLS ───────────────────────────────
DO $$
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000000","role":"authenticated"}';
  BEGIN
    INSERT INTO public.commission_advance_files
      (advance_id, storage_path, file_size, sort_order)
    VALUES ('00000000-0000-0000-0000-000000000000', 'rls/test.webp', 1024, 0);
    INSERT INTO rls_results VALUES ('T2.10', 'FAIL', 'Se esperaba error de constraint pero la inserción tuvo éxito');
  EXCEPTION
    WHEN insufficient_privilege OR foreign_key_violation THEN
      INSERT INTO rls_results VALUES ('T2.10', 'PASS', 'FK/RLS bloqueó archivo con advance_id inexistente');
    WHEN others THEN
      INSERT INTO rls_results VALUES ('T2.10', 'FAIL', 'Error inesperado: ' || SQLERRM);
  END;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  RESULTADOS (aparecen en la pestaña "Results" antes del ROLLBACK)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT test_id, status, detail FROM rls_results ORDER BY test_id;

ROLLBACK;
