export type CommissionStatus =
  | 'PENDIENTE'
  | 'ACEPTADA'
  | 'RECHAZADA'
  | 'EN_PROGRESO'
  | 'EN_REVISION'
  | 'COMPLETADA'
  | 'CANCELADA';

export type IntendedUse = 'personal' | 'comercial';

export interface Commission {
  id: string;
  client_id: string;
  artist_id: string;
  service_id: string;
  status: CommissionStatus;
  description: string;
  pose: string | null;
  key_elements: string | null;
  intended_use: IntendedUse;
  additional_notes: string | null;
  terms_accepted_at: string | null; // ISO 8601
  created_at: string;
}

export interface CommissionReference {
  id: string;
  commission_id: string;
  storage_path: string;
  file_size: number;
  created_at: string;
}

export interface LocalImageAsset {
  uri: string;
  fileName: string;
  fileSize: number; // bytes, antes de compresión
  mimeType: string;
}
