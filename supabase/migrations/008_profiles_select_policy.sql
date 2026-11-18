-- Allow any authenticated user to read any profile row.
-- Needed so that JOINs on profiles!artist_id work in commission queries
-- (e.g. useMyCommissions, useCommissionTrackingDetail).
-- Sensitive fields (email, privacy_accepted_at) are not stored in profiles;
-- handle, display_name and is_artist are intentionally public.
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
