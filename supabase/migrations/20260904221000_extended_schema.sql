-- =================================================================
-- Extensão do Schema da Lista de Compras & Finanças
-- Arquivo: 20260904221000_extended_schema.sql  
-- Adiciona suporte a Listas Planejadas, Wishlist, Recorrentes Master,
-- Despesas Fixas & Ocorrências Mensais, Histórico de Compras e Transferências.
-- =================================================================

-- 1. LISTAS DE COMPRAS PLANEJADAS & ITENS
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL UNIQUE,
  status       TEXT        NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed de destinos padrão para listas de compras
INSERT INTO public.shopping_lists (name) VALUES
  ('Hoje'), ('Amanhã'), ('Esta semana'), ('Este mês'), ('Sem data')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id      UUID        NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  item_id      UUID        NOT NULL REFERENCES public.shopping_items(id) ON DELETE CASCADE,
  quantity     INTEGER     NOT NULL DEFAULT 1,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(list_id, item_id)
);

-- 2. WISHLIST (LISTA DE DESEJOS DEDICADA)
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id        UUID          REFERENCES public.shopping_items(id) ON DELETE SET NULL,
  name           TEXT          NOT NULL,
  store          TEXT,
  price          NUMERIC(12,4) NOT NULL DEFAULT 0,
  desired_price  NUMERIC(12,4),
  wish_status    TEXT          NOT NULL DEFAULT 'quero', -- quero | talvez | em_breve
  priority       TEXT          NOT NULL DEFAULT 'media', -- alta | media | baixa
  planned_month  TEXT,                                   -- ex: "2026-10" | "algum_dia"
  link           TEXT,
  photo          TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 3. RECORRENTES MASTER (CATEGORIAS E PRODUTOS PERMANENTES)
CREATE TABLE IF NOT EXISTS public.recurring_categories (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT        NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.recurring_categories (name) VALUES
  ('Alimentação'), ('Casa / Limpeza'), ('Cuidado Pessoal'), ('Farmácia'), ('Outros')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.recurring_items (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT          NOT NULL,
  category_id    UUID          REFERENCES public.recurring_categories(id) ON DELETE SET NULL,
  category_name  TEXT          NOT NULL DEFAULT 'Outros',
  price          NUMERIC(12,4) NOT NULL DEFAULT 0,
  store          TEXT,
  photo          TEXT,
  frequency      TEXT          NOT NULL DEFAULT 'semanal', -- semanal | quinzenal | mensal | x_dias
  frequency_days INTEGER,
  quantity       INTEGER       NOT NULL DEFAULT 1,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 4. DESPESAS FIXAS MENSAIS E OCORRÊNCIAS
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id                    UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  TEXT          NOT NULL,
  amount                NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency              TEXT          NOT NULL DEFAULT 'EUR',
  due_day               INTEGER       NOT NULL DEFAULT 5,
  category              TEXT          NOT NULL DEFAULT 'Outros',
  preferred_account_id UUID          REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  paused                BOOLEAN       NOT NULL DEFAULT false,
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fixed_expense_occurrences (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixed_expense_id UUID          NOT NULL REFERENCES public.fixed_expenses(id) ON DELETE CASCADE,
  month_year       TEXT          NOT NULL, -- ex: "2026-09"
  due_date         DATE          NOT NULL,
  amount           NUMERIC(12,4) NOT NULL,
  paid             BOOLEAN       NOT NULL DEFAULT false,
  paid_at          TIMESTAMPTZ,
  account_id       UUID          REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(fixed_expense_id, month_year)
);

-- 5. HISTÓRICO DE COMPRAS REALIZADAS
CREATE TABLE IF NOT EXISTS public.purchase_history (
  id                 UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id            UUID          REFERENCES public.shopping_items(id) ON DELETE SET NULL,
  item_name          TEXT          NOT NULL,
  list_name          TEXT,
  paid_amount        NUMERIC(12,4) NOT NULL,
  payment_date       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  account_id         UUID          REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  financial_category TEXT          NOT NULL DEFAULT 'Compras',
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 6. EXTENSÃO DE CONTAS FINANCEIRAS (GRUPOS DE CONTAS)
ALTER TABLE public.finance_accounts
  ADD COLUMN IF NOT EXISTS account_group TEXT DEFAULT 'Banco Físico';

-- 7. TRANSFERÊNCIAS ENTRE CONTAS FINANCIAL
CREATE TABLE IF NOT EXISTS public.finance_transfers (
  id              UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_account_id UUID          NOT NULL REFERENCES public.finance_accounts(id) ON DELETE CASCADE,
  to_account_id   UUID          NOT NULL REFERENCES public.finance_accounts(id) ON DELETE CASCADE,
  amount          NUMERIC(14,4) NOT NULL,
  date            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 8. TRIGGERS DE UPDATED_AT
DROP TRIGGER IF EXISTS shopping_lists_updated_at ON public.shopping_lists;
CREATE TRIGGER shopping_lists_updated_at BEFORE UPDATE ON public.shopping_lists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS shopping_list_items_updated_at ON public.shopping_list_items;
CREATE TRIGGER shopping_list_items_updated_at BEFORE UPDATE ON public.shopping_list_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS wishlist_items_updated_at ON public.wishlist_items;
CREATE TRIGGER wishlist_items_updated_at BEFORE UPDATE ON public.wishlist_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS recurring_items_updated_at ON public.recurring_items;
CREATE TRIGGER recurring_items_updated_at BEFORE UPDATE ON public.recurring_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS fixed_expenses_updated_at ON public.fixed_expenses;
CREATE TRIGGER fixed_expenses_updated_at BEFORE UPDATE ON public.fixed_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS fixed_expense_occurrences_updated_at ON public.fixed_expense_occurrences;
CREATE TRIGGER fixed_expense_occurrences_updated_at BEFORE UPDATE ON public.fixed_expense_occurrences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. ÍNDICES DE PERFORMANCE E CONSULTAS FREQUENTES
CREATE INDEX IF NOT EXISTS shopping_list_items_list_idx ON public.shopping_list_items(list_id);
CREATE INDEX IF NOT EXISTS shopping_list_items_item_idx ON public.shopping_list_items(item_id);
CREATE INDEX IF NOT EXISTS wishlist_items_status_idx ON public.wishlist_items(wish_status);
CREATE INDEX IF NOT EXISTS recurring_items_category_idx ON public.recurring_items(category_id);
CREATE INDEX IF NOT EXISTS fixed_expense_occurrences_expense_idx ON public.fixed_expense_occurrences(fixed_expense_id);
CREATE INDEX IF NOT EXISTS fixed_expense_occurrences_month_idx ON public.fixed_expense_occurrences(month_year);
CREATE INDEX IF NOT EXISTS purchase_history_date_idx ON public.purchase_history(payment_date DESC);
CREATE INDEX IF NOT EXISTS finance_transfers_date_idx ON public.finance_transfers(date DESC);

-- 10. PERMISSÕES SERVICE_ROLE E SEGURANÇA RLS
GRANT ALL ON public.shopping_lists TO service_role;
GRANT ALL ON public.shopping_list_items TO service_role;
GRANT ALL ON public.wishlist_items TO service_role;
GRANT ALL ON public.recurring_categories TO service_role;
GRANT ALL ON public.recurring_items TO service_role;
GRANT ALL ON public.fixed_expenses TO service_role;
GRANT ALL ON public.fixed_expense_occurrences TO service_role;
GRANT ALL ON public.purchase_history TO service_role;
GRANT ALL ON public.finance_transfers TO service_role;

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expense_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transfers ENABLE ROW LEVEL SECURITY;

