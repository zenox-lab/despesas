import { useSession } from "@tanstack/react-start/server";

export type GateSession = { unlocked?: boolean };

export function isLocalAuthBypassed() {
  return process.env["LOCAL_AUTH_BYPASS"] === "true";
}

export function gateSessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "site-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function assertUnlocked() {
  if (isLocalAuthBypassed()) return;
  const session = await useSession<GateSession>(gateSessionConfig());
  if (!session.data.unlocked) throw new Error("Não autorizado");
}
