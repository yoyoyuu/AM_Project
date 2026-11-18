import type { CommissionStatus, CreativeStage } from '../gestion/types';

export type { CommissionStatus, CreativeStage } from '../gestion/types';
export { CREATIVE_STAGE_ORDER } from '../gestion/types';

export interface ClientCommissionSummary {
  id: string;
  status: CommissionStatus;
  current_stage: CreativeStage | null;
  rejection_reason: string | null;
  service_title: string;
  artist_handle: string;
  artist_display_name: string | null;
  updated_at: string;
  created_at: string;
}

export interface CommissionReferenceView {
  id: string;
  storage_path: string;
  signed_url: string | null;
}

export interface ClientCommissionDetail extends ClientCommissionSummary {
  service_base_price: number;
  service_estimated_days: number;
  description: string;
  intended_use: 'personal' | 'comercial';
  pose: string | null;
  key_elements: string | null;
  additional_notes: string | null;
  references: CommissionReferenceView[];
}

export interface CommissionGroups {
  active: ClientCommissionSummary[];
  pending: ClientCommissionSummary[];
  finished: ClientCommissionSummary[];
}
