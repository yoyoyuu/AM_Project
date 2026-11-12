export type CommissionStatus =
  | 'PENDIENTE'
  | 'EN_PROGRESO'
  | 'RECHAZADA'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'EN_REVISION';

export type CreativeStage = 'SKETCH' | 'LINEART' | 'FINAL';

export const CREATIVE_STAGE_ORDER: CreativeStage[] = ['SKETCH', 'LINEART', 'FINAL'];

export interface Commission {
  id: string;
  client_id: string;
  artist_id: string;
  service_id: string;
  status: CommissionStatus;
  current_stage: CreativeStage | null;
  rejection_reason: string | null;
  description: string;
  pose: string | null;
  key_elements: string | null;
  intended_use: 'personal' | 'comercial';
  additional_notes: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionWithDetails extends Commission {
  service: {
    title: string;
    base_price: number;
    estimated_days: number;
  };
  client_profile: {
    handle: string;
    display_name: string | null;
  };
  references: CommissionReference[];
}

export interface CommissionReference {
  id: string;
  commission_id: string;
  storage_path: string;
  file_size: number;
  signed_url: string | null;
}
