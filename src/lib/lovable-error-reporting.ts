// Error reporting genérico — sem dependências de plataforma.
// Substitui o lovable-error-reporting.ts que usava window.__lovableEvents.

/**
 * Reporta um erro capturado pelo React Error Boundary (ou similar).
 * Em produção, apenas regista no console.
 * Pode ser substituído por Sentry, Datadog, etc. no futuro.
 */
export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  const stack = error instanceof Error ? error.stack : undefined;

  console.error("[Error Boundary]", message, { ...context, stack });
}
