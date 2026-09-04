import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function isLocalAuthBypassed() {
  return process.env["LOCAL_AUTH_BYPASS"] === "true";
}

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"] || "minha-lista-secret-key-must-be-32-chars-min",
    name: "site-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const unlockSite = createServerFn({ method: "POST" })
  .validator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const user = process.env["SITE_USERNAME"] || "admin";
    const pass = process.env["SITE_PASSWORD"] || "admin";

    const ok =
      matches(data.username.trim().toLowerCase(), user.trim().toLowerCase()) &&
      matches(data.password, pass);
    if (!ok) return { ok: false as const };

    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const requireUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  if (isLocalAuthBypassed()) return { unlocked: true as const };
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) throw redirect({ to: "/login" });
  return { unlocked: true as const };
});

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});
