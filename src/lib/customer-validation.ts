import { z } from "zod";

export function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, "");
}

export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((v) => v.length >= 10 && v.length <= 13, {
    message: "Telefone inválido (use DDD + número)",
  });

export const customerNameSchema = z
  .string()
  .trim()
  .min(2, "Nome deve ter pelo menos 2 caracteres")
  .max(80, "Nome muito longo");

export const customerSignupSchema = z.object({
  name: customerNameSchema,
  email: z.string().trim().email("E-mail inválido").max(255),
  whatsapp: phoneSchema,
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(72),
});

export const customerCheckoutSchema = z.object({
  name: customerNameSchema,
  whatsapp: phoneSchema,
  notes: z.string().max(300).optional().or(z.literal("")),
});

export const customerProfilePhoneSchema = z.object({
  whatsapp: phoneSchema,
});
