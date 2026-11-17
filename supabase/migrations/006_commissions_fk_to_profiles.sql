-- Reapunta client_id y artist_id de auth.users → public.profiles
-- para que PostgREST pueda resolver el join profiles!client_id en las queries del cliente.
-- public.profiles.id ya referencia auth.users(id), así que la integridad referencial se mantiene.

ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_client_id_fkey,
  DROP CONSTRAINT IF EXISTS commissions_artist_id_fkey;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT commissions_artist_id_fkey
    FOREIGN KEY (artist_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
