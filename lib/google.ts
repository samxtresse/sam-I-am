// Thin Google API client for Calendar + Gmail.
// Tokens live in Supabase (table `secretary_google_tokens`) and are refreshed
// transparently when expired. In stub mode every call returns canned data.

import { env, isStub } from "./env";
import { sb, isStubMode as supaStub } from "./supabase";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "openid",
  "email",
  "profile",
];

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES.join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenRow = {
  owner_email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenRow> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: env.google.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google token exchange failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    owner_email: env.owner.email,
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

export async function persistTokens(row: TokenRow) {
  if (supaStub()) return; // stub mode — drop silently
  // Upsert by owner_email.
  await sb.delete("secretary_google_tokens", { owner_email: `eq.${row.owner_email}` });
  await sb.insert("secretary_google_tokens", row);
}

async function loadTokens(): Promise<TokenRow | null> {
  if (supaStub()) return null;
  const rows = await sb.select<TokenRow>("secretary_google_tokens", {
    owner_email: `eq.${env.owner.email}`,
    limit: "1",
  });
  return rows[0] ?? null;
}

async function refreshTokens(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`google refresh failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return {
    access_token: json.access_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

async function getAccessToken(): Promise<string | null> {
  const row = await loadTokens();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() > Date.now() + 60_000) return row.access_token;
  const fresh = await refreshTokens(row.refresh_token);
  await sb.update("secretary_google_tokens", fresh, {
    owner_email: `eq.${env.owner.email}`,
  });
  return fresh.access_token;
}

export function isGoogleStub() {
  return isStub("google") || supaStub();
}

export async function googleFetch(url: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("google not connected — visit /secretary/setup");
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`google ${res.status}: ${text}`);
  }
  return res.json();
}
