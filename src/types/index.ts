export type Stage = 'Pendiente' | 'Boceto' | 'Lineart' | 'Color' | 'Finalizado';
export type PaymentStatus = 'Pendiente' | 'Anticipo Pagado' | 'Liquidado';

export interface Commission {
  id: string;
  clientName: string;
  title: string;
  style: string;
  price: number;
  stage: Stage;
  paymentStatus: PaymentStatus;
  updatedAt: string;
}

export interface ArtistProfile {
  name: string;
  slotsLimit: number;
  activeSlots: number;
}