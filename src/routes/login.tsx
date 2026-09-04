import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShoppingBasket,
  Wallet,
  AlertCircle,
  Loader2,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockSite } from "@/lib/gate.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Minha Lista & Finanças" },
      {
        name: "description",
        content: "Acesse sua lista de compras e controle financeiro privado.",
      },
      {
        property: "og:title",
        content: "Entrar — Minha Lista & Finanças",
      },
      {
        property: "og:description",
        content: "Área privada da sua lista de compras e gestão financeira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const router = useRouter();
  const unlock = useServerFn(unlockSite);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    setLoading(true);
    setError(null);

    try {
      const res = await unlock({
        data: {
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
        },
      });

      if (res.ok) {
        await router.navigate({
          to: "/",
          replace: true,
        });
        return;
      }

      setError("Login ou senha incorretos.");
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Erro desconhecido ao criar a sessão.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh w-full flex items-center justify-center bg-background p-4 sm:p-6 overflow-hidden">
      <div className="absolute top-1/4 -left-32 size-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 size-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm rounded-3xl border border-border/80 bg-surface/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6 animate-rise">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary/10 p-3.5 text-primary shadow-inner">
            <ShoppingBasket className="size-6 stroke-[2.2]" />
            <span className="text-muted-foreground font-light">|</span>
            <Wallet className="size-6 stroke-[2.2]" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Minha Lista & Finanças
            </h1>

            <p className="text-xs text-muted-foreground font-semibold mt-1">
              Acesse sua conta privada para continuar
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="username"
              className="text-xs font-bold text-foreground"
            >
              Usuário / Login
            </Label>

            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />

              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Digite seu usuário..."
                className="pl-10 h-11 rounded-xl bg-background border-border text-sm font-medium focus-visible:ring-primary"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-bold text-foreground"
            >
              Senha
            </Label>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />

              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha..."
                className="pl-10 pr-11 h-11 rounded-xl bg-background border-border text-sm font-medium focus-visible:ring-primary"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg"
                title={showPassword ? "Ocultar senha" : "Exibir senha"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-extrabold text-sm shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Validando acesso...</span>
              </>
            ) : (
              <>
                <KeyRound className="size-4" />
                <span>Entrar no aplicativo</span>
              </>
            )}
          </Button>
        </form>

        <div className="pt-2 border-t border-border/50 text-center">
          <p className="text-[11px] text-muted-foreground font-medium">
            🔒 Dados protegidos por sessão privada.
          </p>
        </div>
      </div>
    </div>
  );
}