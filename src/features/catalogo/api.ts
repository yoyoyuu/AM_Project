import { supabase } from '../../lib/supabase';
import type {
  ArtistPublicProfile,
  ArtistTos,
  Service,
  ServiceCreate,
  ServiceUpdate,
} from './types';

async function getAuthenticatedUserId(): Promise<string> {
  // getSession() lee la sesión cacheada localmente (sin HTTP round-trip).
  // La autenticidad del user_id la re-valida RLS en el servidor en cada INSERT/UPDATE.
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (session === null) {
    throw new Error('No hay una sesión autenticada.');
  }

  return session.user.id;
}

export async function getMyServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function createService(payload: ServiceCreate): Promise<Service> {
  const artistId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from('services')
    .insert({ ...payload, artist_id: artistId })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateService(
  id: string,
  payload: ServiceUpdate,
): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from('services').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function getMyTos(): Promise<ArtistTos | null> {
  const { data, error } = await supabase
    .from('artist_tos')
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertTos(content: string): Promise<ArtistTos> {
  const artistId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from('artist_tos')
    .upsert({ artist_id: artistId, content })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getArtistPublicProfile(
  handle: string,
): Promise<ArtistPublicProfile | null> {
  const { data, error } = await supabase.rpc('get_artist_public_profile', {
    p_handle: handle,
  });

  if (error) {
    throw error;
  }

  return data as ArtistPublicProfile | null;
}
