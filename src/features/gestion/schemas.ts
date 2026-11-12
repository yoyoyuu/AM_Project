import { z } from 'zod';

export const rejectCommissionSchema = z.object({
  rejection_reason: z
    .string()
    .max(500, 'El motivo no puede superar los 500 caracteres')
    .optional()
    .or(z.literal('')),
});

export type RejectCommissionFormValues = z.infer<typeof rejectCommissionSchema>;
