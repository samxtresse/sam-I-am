import { NextResponse } from "next/server";
import { exchangeCodeForTokens, persistTokens } from "@/lib/google";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${env.appUrl}/secretary/setup?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${env.appUrl}/secretary/setup?error=missing_code`);
  }
  try {
    const tokens = await exchangeCodeForTokens(code);
    await persistTokens(tokens);
    return NextResponse.redirect(`${env.appUrl}/secretary?connected=google`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      `${env.appUrl}/secretary/setup?error=${encodeURIComponent(msg)}`,
    );
  }
}
