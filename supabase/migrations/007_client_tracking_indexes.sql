-- Migration 007: índices compuestos para las consultas de seguimiento del cliente (Spec 005)
-- Cubre RF-05-A (consulta de lista) y RNF-01 (tiempo de carga ≤ 2 s)

-- Índice 1: búsqueda de todas las comisiones de un cliente, ordenadas por updated_at
-- Cubre la query principal de MyCommissionsScreen
CREATE INDEX IF NOT EXISTS idx_commissions_client_updated
  ON public.commissions (client_id, updated_at DESC);

-- Índice 2: búsqueda de comisiones de un cliente filtradas por status
-- Cubre la agrupación por secciones (En curso / Pendientes / Finalizadas)
CREATE INDEX IF NOT EXISTS idx_commissions_client_status
  ON public.commissions (client_id, status);
