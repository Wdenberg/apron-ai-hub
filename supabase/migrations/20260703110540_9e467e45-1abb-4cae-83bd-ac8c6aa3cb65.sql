ALTER TABLE public.admin_invites ALTER COLUMN invited_by DROP NOT NULL;
INSERT INTO public.admin_invites (email, invited_by) VALUES ('wdenberg42@gmail.com', NULL) ON CONFLICT (email) DO NOTHING;