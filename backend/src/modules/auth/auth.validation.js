import { z } from 'zod';
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const imageData = z.string().max(180000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Envie uma imagem PNG, JPG ou WebP válida.');
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()).optional(),
  avatarData: imageData.nullable().optional()
}).refine(value => Object.keys(value).length > 0);
export const changePasswordSchema = z.object({ newPassword: z.string().min(1, 'Informe a nova senha.').max(128) });
