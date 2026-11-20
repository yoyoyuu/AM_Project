import type { CommissionStatus, CreativeStage } from '../gestion/types';

export type PaymentStatus = 'UNPAID' | 'UNDER_REVIEW' | 'NEEDS_CORRECTION' | 'VERIFIED';

export interface CommissionPayment {
  id: string;
  client_id: string;
  artist_id: string;
  status: CommissionStatus;
  current_stage: CreativeStage | null;
  base_price: number;
  payment_status: PaymentStatus;
  payment_proof_path: string | null;
  payment_proof_uploaded_at: string | null;
  payment_reference: string | null;
  payment_note: string | null;
  payment_correction_reason: string | null;
  paid_verified_at: string | null;
  deliverable_path: string | null;
  deliverable_size: number | null;
  delivered_at: string | null;
}

export type PaymentRpcErrorCode =
  | 'not_authenticated'
  | 'forbidden'
  | 'invalid_payment_state'
  | 'invalid_reason'
  | 'invalid_stage'
  | 'file_too_large'
  | 'proof_not_found'
  | 'deliverable_not_found';
