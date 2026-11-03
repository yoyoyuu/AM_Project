-- T010: manual RLS checks for the profiles table.
-- Replace both UUIDs with two existing authenticated users before running this
-- script in the Supabase SQL editor. Both users must have a profile and handle.
--
-- The transaction is rolled back at the end, so the test does not persist data.

begin;

create temp table t010_users (
  user_a uuid not null,
  user_b uuid not null
);

insert into t010_users (user_a, user_b)
values (
  'a2db0764-5b01-4608-abea-8cdada298bcd',
  '1e1d819f-1ee6-44b5-b538-23a20dd83bd8'
);

do $$
declare
  artist_profiles integer;
begin
  select count(*)
  into artist_profiles
  from public.profiles
  where id in (
    (select user_a from t010_users),
    (select user_b from t010_users)
  )
  and handle is not null;

  if artist_profiles <> 2 then
    raise exception 'T010 requiere dos usuarios con perfil de artista existente';
  end if;
end;
$$;

-- An anonymous client cannot read profiles.
set local role anon;
do $$
declare
  visible_profiles integer;
begin
  begin
    select count(*) into visible_profiles from public.profiles;
    if visible_profiles <> 0 then
      raise exception 'T010 fallo: anon puede leer profiles';
    end if;
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

-- Each authenticated user can read only their own profile.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_a::text from t010_users),
  true
);

do $$
declare
  own_profiles integer;
  other_profiles integer;
begin
  select count(*) into own_profiles
  from public.profiles
  where id = (select user_a from t010_users);
  select count(*) into other_profiles
  from public.profiles
  where id = (select user_b from t010_users);

  if own_profiles <> 1 or other_profiles <> 0 then
    raise exception 'T010 fallo: user_a lee un perfil ajeno';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select user_b::text from t010_users),
  true
);

do $$
declare
  own_profiles integer;
  other_profiles integer;
begin
  select count(*) into own_profiles
  from public.profiles
  where id = (select user_b from t010_users);
  select count(*) into other_profiles
  from public.profiles
  where id = (select user_a from t010_users);

  if own_profiles <> 1 or other_profiles <> 0 then
    raise exception 'T010 fallo: user_b lee un perfil ajeno';
  end if;
end;
$$;

-- A user cannot update another user's profile.
select set_config('request.jwt.claim.sub', user_a::text, true)
from t010_users;

do $$
declare
  updated_rows integer;
begin
  update public.profiles
  set display_name = 'T010 no debe persistir'
  where id = (select user_b from t010_users);
  get diagnostics updated_rows = row_count;

  if updated_rows <> 0 then
    raise exception 'T010 fallo: user_a edita el perfil de user_b';
  end if;
end;
$$;

-- Privacy fields and generated role/completion fields are not editable.
do $$
declare
  rejected boolean;
begin
  begin
    update public.profiles
    set privacy_accepted_at = now()
    where id = (select user_a from t010_users);
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not coalesce(rejected, false) then
    raise exception 'T010 fallo: privacy_accepted_at es editable';
  end if;
end;
$$;

do $$
declare
  rejected boolean;
begin
  begin
    update public.profiles
    set privacy_notice_version = 'T010'
    where id = (select user_a from t010_users);
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not coalesce(rejected, false) then
    raise exception 'T010 fallo: privacy_notice_version es editable';
  end if;
end;
$$;

do $$
declare
  rejected boolean;
begin
  begin
    update public.profiles
    set profile_complete = false
    where id = (select user_a from t010_users);
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not coalesce(rejected, false) then
    raise exception 'T010 fallo: profile_complete es editable';
  end if;
end;
$$;

do $$
declare
  rejected boolean;
begin
  begin
    update public.profiles
    set is_artist = false
    where id = (select user_a from t010_users);
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not coalesce(rejected, false) then
    raise exception 'T010 fallo: is_artist es editable';
  end if;
end;
$$;

-- The database rejects duplicate and reserved handles.
do $$
declare
  rejected boolean;
  test_handle text := 't010-a-' || txid_current()::text;
begin
  update public.profiles
  set handle = test_handle
  where id = (select user_a from t010_users);

  begin
    update public.profiles
    set handle = test_handle
    where id = (select user_b from t010_users);
  exception
    when unique_violation then
      rejected := true;
  end;

  if not coalesce(rejected, false) then
    raise exception 'T010 fallo: se acepto un handle duplicado';
  end if;
end;
$$;

do $$
declare
  rejected boolean;
begin
  begin
    update public.profiles
    set handle = 'admin'
    where id = (select user_a from t010_users);
  exception
    when check_violation then
      rejected := true;
  end;
  if not coalesce(rejected, false) then
    raise exception 'T010 fallo: se acepto un handle reservado';
  end if;
end;
$$;

-- An active artist cannot remove their handle.
do $$
declare
  rejected boolean;
begin
  begin
    update public.profiles
    set handle = null
    where id = (select user_a from t010_users);
  exception
    when raise_exception then
      rejected := true;
  end;
  if not coalesce(rejected, false) then
    raise exception 'T010 fallo: se pudo borrar el handle';
  end if;
end;
$$;

-- A registration without explicit privacy consent is rejected by the trigger.
reset role;
do $$
declare
  rejected boolean;
  error_message text;
begin
  begin
    insert into auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      raw_user_meta_data
    )
    values (
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      't010-no-consent@example.invalid',
      'T010-placeholder',
      '{}'::jsonb
    );
  exception
    when others then
      rejected := true;
      get stacked diagnostics error_message = message_text;
  end;
  if not coalesce(rejected, false)
    or error_message not like '%privacy_not_accepted%' then
    raise exception 'T010 fallo: se acepto un registro sin consentimiento';
  end if;
end;
$$;

rollback;
