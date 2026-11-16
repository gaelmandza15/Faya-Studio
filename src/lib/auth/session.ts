import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { db } from "@/lib/db";

const SESSION_COOKIE = "faya_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } },
  });

  await db.session.create({
    data: { tokenHash, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session
      .delete({ where: { id: session.id } })
      .catch(() => undefined);
    return null;
  }

  return session;
}

export async function requireUser() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function updateUserLocale(userId: string, locale: Locale) {
  await db.user.update({
    where: { id: userId },
    data: { locale },
  });
}
