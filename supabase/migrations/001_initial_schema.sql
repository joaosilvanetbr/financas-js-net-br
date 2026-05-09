-- Migration 001: Schema inicial do controle financeiro
-- Aplica: tabelas, RLS, policies, indexes
-- Data: 2026-05-09

-- Habilita extensao para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Perfis de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorias (entrada/saida)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  color TEXT NOT NULL DEFAULT '#1971c2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lancamentos
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  entry_date DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  notes TEXT,
  source_recurring_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL,
  source_month TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recorrencias
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Limites por categoria
CREATE TABLE IF NOT EXISTS public.category_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id)
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_limits ENABLE ROW LEVEL SECURITY;

-- Policies: profiles
CREATE POLICY "profiles own select" ON public.profiles FOR SELECT USING ((SELECT auth.uid()) = id);
CREATE POLICY "profiles own insert" ON public.profiles FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

-- Policies: categories
CREATE POLICY "categories own select" ON public.categories FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "categories own insert" ON public.categories FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "categories own update" ON public.categories FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "categories own delete" ON public.categories FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Policies: transactions
CREATE POLICY "transactions own select" ON public.transactions FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "transactions own insert" ON public.transactions FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "transactions own update" ON public.transactions FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "transactions own delete" ON public.transactions FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Policies: recurring_transactions
CREATE POLICY "recurring own select" ON public.recurring_transactions FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "recurring own insert" ON public.recurring_transactions FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "recurring own update" ON public.recurring_transactions FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "recurring own delete" ON public.recurring_transactions FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Policies: category_limits
CREATE POLICY "category limits own select" ON public.category_limits FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "category limits own insert" ON public.category_limits FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "category limits own update" ON public.category_limits FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "category limits own delete" ON public.category_limits FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS categories_user_id_idx ON public.categories(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_type_name_unique_idx ON public.categories(user_id, type, LOWER(BTRIM(name)));
CREATE INDEX IF NOT EXISTS category_limits_user_id_idx ON public.category_limits(user_id);
CREATE INDEX IF NOT EXISTS category_limits_category_id_idx ON public.category_limits(category_id);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON public.transactions(user_id, entry_date);
CREATE INDEX IF NOT EXISTS transactions_category_id_idx ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS transactions_source_recurring_id_idx ON public.transactions(source_recurring_id);
CREATE INDEX IF NOT EXISTS recurring_user_id_idx ON public.recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS recurring_transactions_category_id_idx ON public.recurring_transactions(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_recurring_month_unique_idx
  ON public.transactions(user_id, source_recurring_id, source_month)
  WHERE source_recurring_id IS NOT NULL AND source_month IS NOT NULL;
