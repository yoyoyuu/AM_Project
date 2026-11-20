import { z } from 'zod';

export const paymentProofSchema = z.object({
  reference: z
    .string()
    .trim()
    .max(60, 'La referencia no puede superar los 60 caracteres')
    .optional()
    .or(z.literal('')),
  note: z
    .string()
    .trim()
    .max(300, 'La nota no puede superar los 300 caracteres')
    .optional()
    .or(z.literal('')),
});
export type PaymentProofFormValues = z.infer<typeof paymentProofSchema>;

export const paymentCorrectionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Indica el motivo de la corrección (mínimo 5 caracteres)')
    .max(300, 'El motivo no puede superar los 300 caracteres'),
});
export type PaymentCorrectionFormValues = z.infer<typeof paymentCorrectionSchema>;
