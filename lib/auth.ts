import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE_NAME = "sam_secretary_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function setSessionCookie() {
  cookies().set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export function hasSession() {
  return cookies().get(COOKIE_NAME)?.value === "1";
}

// Constant-time-ish compare — the token is short, but matters because this
// is the only gate. Equal length first, then char compare.
export function checkToken(provided: string) {
  const expected = env.authToken;
  if (!expected) return false; // misconfigured — refuse to unlock
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
