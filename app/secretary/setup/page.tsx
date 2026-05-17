import { hasSession } from "@/lib/auth";
import { UnlockForm } from "@/components/setup/unlock-form";
import { integrationStatus, env } from "@/lib/env";
import Link from "next/link";

export default function SecretarySetup() {
  const unlocked = hasSession();
  const google = integrationStatus("google");
  const supabase = integrationStatus("supabase");
  const anthropic = integrationStatus("anthropic");

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="card p-6">
        <h1 className="display text-2xl">Secretary setup</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Single-tenant. Owner: <code>{env.owner.email}</code>.
        </p>

        <ol className="mt-6 space-y-6">
          <li className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="tag tag-stub">1</span>
              <span className="font-medium">Unlock with SECRETARY_AUTH_TOKEN</span>
              {unlocked ? <span className="tag tag-live">unlocked</span> : null}
            </div>
            {unlocked ? (
              <p className="text-sm text-ink-muted">
                Cookie set for 30 days. <Link className="underline" href="/secretary">Open chat →</Link>
              </p>
            ) : (
              <UnlockForm />
            )}
          </li>

          <li className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="tag tag-stub">2</span>
              <span className="font-medium">Connect Google (Calendar + Gmail)</span>
              <span className={`tag ${google === "live" ? "tag-live" : "tag-stub"}`}>{google}</span>
            </div>
            <p className="text-sm text-ink-muted">
              Required: <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code>, redirect URI{" "}
              <code>{env.google.redirectUri}</code>.
            </p>
            {unlocked && google === "live" ? (
              <a className="btn btn-primary" href="/api/secretary/auth/google">
                Connect Google
              </a>
            ) : (
              <p className="text-xs text-ink-muted">
                {unlocked
                  ? "Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET, redeploy, then come back."
                  : "Unlock first."}
              </p>
            )}
          </li>

          <li className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="tag tag-stub">3</span>
              <span className="font-medium">Supabase migrations</span>
              <span className={`tag ${supabase === "live" ? "tag-live" : "tag-stub"}`}>
                {supabase}
              </span>
            </div>
            <p className="text-sm text-ink-muted">
              Run <code>supabase/migrations/0001_secretary.sql</code> through{" "}
              <code>0006_pre_meeting.sql</code> in order. Until then, memory / notes / approvals
              persist in-process only (stub mode).
            </p>
          </li>

          <li className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="tag tag-stub">4</span>
              <span className="font-medium">Anthropic API key</span>
              <span className={`tag ${anthropic === "live" ? "tag-live" : "tag-stub"}`}>
                {anthropic}
              </span>
            </div>
            <p className="text-sm text-ink-muted">
              Set <code>ANTHROPIC_API_KEY</code>. Default model: <code>{env.anthropic.model}</code>.
            </p>
          </li>
        </ol>
      </div>
    </div>
  );
}
