import { z } from 'zod';

const titleMessage = 'El título debe tener entre 3 y 80 caracteres';
const priceMessage = 'El precio debe ser un número entero mayor que cero';
const deliveryMessage =
  'El tiempo de entrega debe ser entre 1 y 365 días';

export const serviceSchema = z.object({
  title: z.string().min(3, titleMessage).max(80, titleMessage),
  description: z
    .string()
    .max(1000, 'La descripción no puede superar los 1 000 caracteres')
    .nullable()
    .optional(),
  price_mxn: z
    .number({ error: priceMessage })
    .int(priceMessage)
    .positive(priceMessage),
  delivery_days: z
    .number({ error: deliveryMessage })
    .int(deliveryMessage)
    .min(1, deliveryMessage)
    .max(365, deliveryMessage),
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;

export const tosSchema = z.object({
  content: z
    .string()
    .min(10, 'Los términos de servicio deben tener al menos 10 caracteres')
    .max(5000, 'Los términos de servicio no pueden superar los 5 000 caracteres'),
});

export type TosFormValues = z.infer<typeof tosSchema>;

export const searchHandleSchema = z.object({
  query: z
    .string()
    .min(1, 'Completa todos los campos obligatorios')
    .transform((value) => (value.startsWith('@') ? value.slice(1) : value)),
});

export type SearchHandleValues = z.infer<typeof searchHandleSchema>;
