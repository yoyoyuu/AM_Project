export type ServiceStatus = 'active' | 'paused';

export interface Service {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  price_mxn: number;
  delivery_days: number;
  status: ServiceStatus;
  created_at: string;
  updated_at: string;
}

export type ServiceCreate = Omit<
  Service,
  'id' | 'artist_id' | 'created_at' | 'updated_at'
>;

export type ServiceUpdate = Partial<ServiceCreate>;

export interface ArtistTos {
  artist_id: string;
  content: string | null;
  updated_at: string;
}

export interface PublicServiceItem {
  id: string;
  title: string;
  description: string | null;
  price_mxn: number;
  delivery_days: number;
  created_at: string;
}

export interface ArtistPublicProfile {
  display_name: string;
  handle: string;
  services: PublicServiceItem[];
  tos: string | null;
}
