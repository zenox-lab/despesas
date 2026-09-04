-- =================================================================
-- Schema completo da Lista de Compras
-- Arquivo: 20260903000000_schema_completo.sql  
-- Aplicar num Supabase novo limpo do zero.
-- Todas as migracoes anteriores sao substituidas por este unico ficheiro.
-- =================================================================

-- Funcao auxiliar para updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =================================================================
-- SHOPPING -- lista de compras principal
-- =================================================================

CREATE TABLE IF NOT EXISTS public.shopping_items (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT          NOT NULL,
  price          NUMERIC(12,4) NOT NULL DEFAULT 0,
  link           TEXT,
  photo          TEXT,
  category       TEXT          NOT NULL DEFAULT 'Outros',
  bought         BOOLEAN       NOT NULL DEFAULT false,
  -- Intencao do item: comprar | desejo | recorrente
  -- (plan e o campo legado mantido para retrocompatibilidade)
  plan           TEXT,
  intent         TEXT,
  -- Campos gerais
  store          TEXT,
  address        TEXT,
  quantity       INTEGER       NOT NULL DEFAULT 1,
  notes          TEXT,
  priority       TEXT,
  -- Campos de desejo
  wish_status    TEXT,
  desired_price  NUMERIC(12,4),
  planned_month  TEXT,
  -- Campos de recorrente
  frequency      TEXT,
  frequency_days INTEGER,
  last_date      DATE,
  next_date      DATE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shopping_categories (
  name           TEXT          NOT NULL PRIMARY KEY,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Seed de categorias padrao
INSERT INTO public.shopping_categories (name) VALUES
  ('Beleza'), ('Cuidado Pessoal'), ('Casa/Limpeza'), ('Alimentação'),
  ('Farmácia'), ('Eletrônicos'), ('Outros')
ON CONFLICT (name) DO NOTHING;

-- Trigger updated_at
DROP TRIGGER IF EXISTS shopping_items_updated_at ON public.shopping_items;
CREATE TRIGGER shopping_items_updated_at
  BEFORE UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permissoes: apenas service_role tem acesso (app usa admin key no servidor)
GRANT ALL ON public.shopping_items     TO service_role;
GRANT ALL ON public.shopping_categories TO service_role;

-- RLS activo mas sem politica anonima (acesso via service_role key apenas)
ALTER TABLE public.shopping_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_categories ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- FINANCAS -- contas, despesas e movimentacoes
-- (atualmente armazenados em localStorage -- tabelas preparadas para migracao futura)
-- =================================================================

CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id         UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT          NOT NULL,
  kind       TEXT          NOT NULL DEFAULT 'banco',
  currency   TEXT          NOT NULL DEFAULT 'EUR',
  balance    NUMERIC(14,4) NOT NULL DEFAULT 0,
  color      TEXT          NOT NULL DEFAULT '#2563eb',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id         UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT          NOT NULL,
  amount     NUMERIC(12,4) NOT NULL DEFAULT 0,
  category   TEXT          NOT NULL DEFAULT 'Outros',
  due_day    INTEGER       NOT NULL DEFAULT 1,
  frequency  TEXT          NOT NULL DEFAULT 'mensal',
  paid       BOOLEAN       NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_movements (
  id          UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id  UUID          NOT NULL REFERENCES public.finance_accounts(id) ON DELETE CASCADE,
  type        TEXT          NOT NULL,
  amount      NUMERIC(14,4) NOT NULL,
  description TEXT,
  date        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Triggers updated_at
DROP TRIGGER IF EXISTS finance_accounts_updated_at ON public.finance_accounts;
CREATE TRIGGER finance_accounts_updated_at
  BEFORE UPDATE ON public.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS finance_expenses_updated_at ON public.finance_expenses;
CREATE TRIGGER finance_expenses_updated_at
  BEFORE UPDATE ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permissoes e RLS
GRANT ALL ON public.finance_accounts   TO service_role;
GRANT ALL ON public.finance_expenses   TO service_role;
GRANT ALL ON public.finance_movements  TO service_role;

ALTER TABLE public.finance_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_movements  ENABLE ROW LEVEL SECURITY;

-- Indice para ordenar movimentacoes por data
CREATE INDEX IF NOT EXISTS finance_movements_date_idx ON public.finance_movements (date DESC);
CREATE INDEX IF NOT EXISTS finance_movements_account_idx ON public.finance_movements (account_id);
