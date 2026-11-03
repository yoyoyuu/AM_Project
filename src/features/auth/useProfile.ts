import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { getAuthErrorMessage } from './errors';
import { useAuth } from './AuthProvider';
import { supabase } from '../../lib/supabase';

export type ArtistProfile = {
  id: string;
  display_name: string | null;
  handle: string | null;
  privacy_accepted_at: string;
  privacy_notice_version: string;
  profile_complete: boolean;
  is_artist: boolean;
  created_at: string;
  updated_at: string;
};

type ProfileUpdate = {
  displayName?: string;
  handle?: string;
};

const profileQueryKey = (userId: string) => ['profile', userId] as const;

async function fetchProfile(userId: string): Promise<ArtistProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return data as ArtistProfile;
}

async function updateProfile(
  userId: string,
  update: ProfileUpdate,
): Promise<ArtistProfile> {
  if (!userId) {
    throw new Error('No hay una sesión activa.');
  }

  const values: Record<string, string> = {};
  if (update.displayName !== undefined) {
    values.display_name = update.displayName;
  }
  if (update.handle !== undefined) {
    values.handle = update.handle;
  }
  if (Object.keys(values).length === 0) {
    throw new Error('No hay cambios de perfil para guardar.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return data as ArtistProfile;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';

  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => fetchProfile(userId),
    enabled: userId.length > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (update: ProfileUpdate) => updateProfile(userId, update),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey(userId), profile);
    },
  });

  return {
    ...profileQuery,
    profile: profileQuery.data ?? null,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    activateArtist: (handle: string) =>
      updateMutation.mutateAsync({ handle }),
  };
}
