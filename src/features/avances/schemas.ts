import { z } from 'zod';

export const uploadAdvanceSchema = z.object({
  note: z
    .string()
    .max(300, 'La nota no puede superar los 300 caracteres')
    .optional()
    .or(z.literal('')),
});

export type UploadAdvanceFormValues = z.infer<typeof uploadAdvanceSchema>;
