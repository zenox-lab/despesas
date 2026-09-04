ALTER TABLE public.shopping_items ADD COLUMN IF NOT EXISTS plan text;

INSERT INTO public.shopping_categories (name) VALUES
  ('Beleza'), ('Cuidado Pessoal'), ('Casa/Limpeza'), ('Alimentação'),
  ('Farmácia'), ('Eletrônicos'), ('Outros')
ON CONFLICT (name) DO NOTHING;