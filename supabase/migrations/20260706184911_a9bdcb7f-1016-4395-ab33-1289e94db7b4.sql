-- 1) Rename 'recebido' -> 'pendente' (preserves all historical rows)
ALTER TYPE public.order_status RENAME VALUE 'recebido' TO 'pendente';

-- 2) Add 'saiu_entrega' status between 'pronto' and 'entregue'
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'saiu_entrega' BEFORE 'entregue';

-- 3) Update default to the renamed value
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pendente'::public.order_status;

-- 4) New payment_status enum
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pendente', 'pago', 'nao_pago');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'pendente';

-- 6) Trigger: when marking as 'entregue', payment_status must be settled
CREATE OR REPLACE FUNCTION public.enforce_payment_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'entregue' AND NEW.payment_status = 'pendente' THEN
    RAISE EXCEPTION 'Informe a situação do pagamento (Pago ou Não pago) ao entregar o pedido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_enforce_payment_on_delivery ON public.orders;
CREATE TRIGGER orders_enforce_payment_on_delivery
BEFORE UPDATE OF status, payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_on_delivery();