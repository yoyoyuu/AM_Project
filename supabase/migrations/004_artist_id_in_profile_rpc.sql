-- Expone artist_id en el perfil público para que los clientes
-- puedan construir la URL de solicitud de comisión sin acceso directo
-- a la tabla profiles (protegida por RLS).
create or replace function public.get_artist_public_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile  record;
  v_services jsonb;
  v_tos      text;
begin
  select id, display_name, handle
  into v_profile
  from public.profiles
  where handle = p_handle;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',            s.id,
      'title',         s.title,
      'description',   s.description,
      'price_mxn',     s.price_mxn,
      'delivery_days', s.delivery_days,
      'created_at',    s.created_at
    ) order by s.created_at desc
  ), '[]'::jsonb)
  into v_services
  from public.services s
  where s.artist_id = v_profile.id
    and s.status = 'active';

  select content
  into v_tos
  from public.artist_tos
  where artist_id = v_profile.id;

  return jsonb_build_object(
    'artist_id',    v_profile.id,
    'display_name', v_profile.display_name,
    'handle',       v_profile.handle,
    'services',     v_services,
    'tos',          v_tos
  );
end;
$$;
