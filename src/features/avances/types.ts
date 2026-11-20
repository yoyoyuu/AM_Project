import type { CreativeStage } from '../gestion/types';

export interface CommissionAdvance {
  id: string;
  commission_id: string;
  artist_id: string;
  stage: CreativeStage;
  note: string | null;
  created_at: string;
  files: CommissionAdvanceFile[];
}

export interface CommissionAdvanceFile {
  id: string;
  advance_id: string;
  storage_path: string;
  file_size: number;
  sort_order: number;
  signed_url: string | null;
}
