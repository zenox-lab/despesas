# Guia de Deployment (Vercel + Supabase)

Este projeto foi migrado de Lovable para um ambiente autónomo utilizando a Vercel (para o frontend/servidor SSR) e o Supabase (para a base de dados).

## 1. Configurar Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com/).
2. Vá a **Project Settings -> API** e copie:
   - **Project URL** (`SUPABASE_URL` e `VITE_SUPABASE_URL`)
   - **anon `public` key** (`VITE_SUPABASE_ANON_KEY`)
   - **service_role `secret` key** (`SUPABASE_SERVICE_ROLE_KEY`)
3. Vá a **SQL Editor** no dashboard do Supabase.
4. Copie todo o conteúdo do ficheiro `supabase/migrations/20260903000000_schema_completo.sql` e execute no SQL Editor para criar o schema completo da base de dados.
5. (Opcional) A autenticação na aplicação é gerida localmente via cookies HTTP-only. Não é estritamente necessário configurar o Supabase Auth para já.

## 2. Configurar Vercel

1. Crie um novo projeto na [Vercel](https://vercel.com/) e ligue ao seu repositório Git.
2. Nas definições de **Build and Output Settings**, a Vercel deve detetar automaticamente o framework (Vite).
   - O comando de build deve ser `npm run build` ou `pnpm build`.
   - O output é gerido automaticamente pelo preset Nitro (`.vercel/output`).
3. Vá a **Environment Variables** e adicione:
   - `VITE_SUPABASE_URL`: (o URL do projeto)
   - `VITE_SUPABASE_ANON_KEY`: (a chave pública anon)
   - `SUPABASE_URL`: (o URL do projeto)
   - `SUPABASE_SERVICE_ROLE_KEY`: (a chave secreta service_role)
   - `SESSION_SECRET`: Uma string aleatória longa (ex: gerada com `openssl rand -base64 32`)
   - `SITE_USERNAME`: O seu nome de utilizador para login
   - `SITE_PASSWORD`: A sua palavra-passe para login
   - `LOCAL_AUTH_BYPASS`: `false` (obrigatório para ativar o login em produção)

## 3. Desenvolvimento Local

1. Copie o `.env.example` para `.env` (ou `.env.local`).
2. Preencha as variáveis de ambiente com as credenciais do Supabase.
3. Para desenvolvimento local sem necessitar de fazer login a toda a hora, mantenha `LOCAL_AUTH_BYPASS=true` no seu `.env`.

> **Nota:** Nunca faça commit do ficheiro `.env` para o repositório Git.

