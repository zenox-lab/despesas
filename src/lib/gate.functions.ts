import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function isLocalAuthBypassed() {
  return process.env["LOCAL_AUTH_BYPASS"] === "true";
}

function sessionConfig() {
  const secret =
    process.env["SESSION_SECRET"]?.trim() ||
    "minha-lista-secret-key-must-be-32-chars-min";

  return {
    password: secret,
    name: "site-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

function normalize(value: string) {
  return value.trim();
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(normalize(input), "utf8").digest();
  const b = createHash("sha256").update(normalize(expected), "utf8").digest();

  return timingSafeEqual(a, b);
}

export const unlockSite = createServerFn({ method: "POST" })
  .validator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const user = (process.env["SITE_USERNAME"] || "admin").trim();
    const pass = (process.env["SITE_PASSWORD"] || "admin").trim();

    const usernameOk = matches(
      data.username.toLowerCase(),
      user.toLowerCase(),
    );

    const passwordOk = matches(data.password, pass);

    if (!usernameOk || !passwordOk) {
      console.error("[AUTH] Invalid credentials", {
        usernameProvidedLength: data.username.length,
        usernameExpectedLength: user.length,
        passwordProvidedLength: data.password.length,
        passwordExpectedLength: pass.length,
      });

      return { ok: false as const };
    }

    const session = await useSession<GateSession>(sessionConfig());

    await session.update({
      unlocked: true,
    });

    return { ok: true as const };
  });

export const requireUnlocked = createServerFn({ method: "GET" }).handler(
  async () => {
    if (isLocalAuthBypassed()) {
      return { unlocked: true as const };
    }

    const session = await useSession<GateSession>(sessionConfig());

    if (!session.data.unlocked) {
      throw redirect({ to: "/login" });
    }

    return { unlocked: true as const };
  },
);

export const lockSite = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await useSession<GateSession>(sessionConfig());

    await session.clear();

    return { ok: true as const };
  },
);