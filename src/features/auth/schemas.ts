import { z } from 'zod';

import { messages } from './messages';

const reservedHandles = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'login',
  'logout',
  'register',
  'registro',
  'signup',
  'signin',
  'verify',
  'reset',
  'forgot',
  'profile',
  'perfil',
  'settings',
  'ajustes',
  'support',
  'soporte',
  'help',
  'ayuda',
  'koma',
  'www',
  'mail',
  'root',
  'about',
  'terms',
  'privacy',
  'privacidad',
  'comisiones',
  'catalogo',
  'artista',
  'artistas',
  'cliente',
  'clientes',
]);

const emailSchema = z
  .string()
  .trim()
  .email(messages.invalidField);

const passwordSchema = z
  .string()
  .min(8, messages.passwordTooShort);

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener entre 2 y 50 caracteres')
  .max(50, 'El nombre debe tener entre 2 y 50 caracteres');

export const handleSchema = z
  .string()
  .min(3, messages.invalidHandle)
  .max(30, messages.invalidHandle)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, messages.invalidHandle)
  .refine((handle) => !reservedHandles.has(handle), messages.reservedHandle);

export const registrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  privacyAccepted: z.boolean().refine(Boolean, messages.privacyNotAccepted),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const profileSchema = z.object({
  displayName: displayNameSchema,
  handle: handleSchema,
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
