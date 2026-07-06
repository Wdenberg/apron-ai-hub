CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_unique
  ON public.profiles (whatsapp)
  WHERE whatsapp IS NOT NULL AND whatsapp <> '';