import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import * as api from './api';
import { catalogoErrors } from './errors';
import type { ServiceCreate, ServiceUpdate } from './types';

export const catalogoKeys = {
  myServices: () => ['catalogo', 'my-services'] as const,
  myTos: () => ['catalogo', 'my-tos'] as const,
  publicProfile: (handle: string) => ['catalogo', 'public', handle] as const,
};

export function useMyServices() {
  return useQuery({
    queryKey: catalogoKeys.myServices(),
    queryFn: api.getMyServices,
    staleTime: 1000 * 60 * 2,
  });
}

export function useMyTos() {
  return useQuery({
    queryKey: catalogoKeys.myTos(),
    queryFn: api.getMyTos,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ServiceCreate) => api.createService(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: catalogoKeys.myServices(),
      });
    },
    onError: (error) => {
      catalogoErrors.handle(error);
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ServiceUpdate }) =>
      api.updateService(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: catalogoKeys.myServices(),
      });
    },
    onError: (error) => {
      catalogoErrors.handle(error);
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteService(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: catalogoKeys.myServices(),
      });
    },
    onError: (error) => {
      catalogoErrors.handle(error);
    },
  });
}

export function useUpsertTos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => api.upsertTos(content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogoKeys.myTos() });
    },
    onError: (error) => {
      catalogoErrors.handle(error);
    },
  });
}

export function useArtistPublicProfile(handle: string) {
  return useQuery({
    queryKey: catalogoKeys.publicProfile(handle),
    queryFn: () => api.getArtistPublicProfile(handle),
    enabled: handle.length > 0,
    staleTime: 1000 * 60,
  });
}
