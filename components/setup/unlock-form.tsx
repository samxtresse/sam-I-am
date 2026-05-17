"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function UnlockForm() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/secretary/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Invalid token. Check SECRETARY_AUTH_TOKEN in env.");
      return;
    }
    const next = params.get("next") || "/secretary";
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 max-w-sm">
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="SECRETARY_AUTH_TOKEN"
        className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm"
        autoFocus
      />
      {error ? <p className="text-xs text-loss">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Unlocking…" : "Unlock"}
      </button>
    </form>
  );
}
