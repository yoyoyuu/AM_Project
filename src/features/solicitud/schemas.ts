import { z } from 'zod';

export const commissionRequestSchema = z.object({
  description: z
    .string()
    .min(20, 'La descripción debe tener al menos 20 caracteres')
    .max(2000, 'La descripción no puede superar los 2 000 caracteres'),
  pose: z
    .string()
    .max(500, 'Este campo no puede superar los 500 caracteres')
    .optional(),
  key_elements: z
    .string()
    .max(500, 'Este campo no puede superar los 500 caracteres')
    .optional(),
  intended_use: z.enum(['personal', 'comercial'], {
    error: 'Indica el uso previsto de la comisión',
  }),
  additional_notes: z
    .string()
    .max(500, 'Este campo no puede superar los 500 caracteres')
    .optional(),
  terms_accepted: z.boolean().optional(),
});

export type CommissionRequestFormValues = z.infer<typeof commissionRequestSchema>;
