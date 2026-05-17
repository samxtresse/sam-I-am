import { googleFetch, isGoogleStub } from "@/lib/google";

type Input = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

const STUB_THREADS = [
  {
    id: "stub_thread_1",
    snippet: "[stub] Hey Sam — wanted to revisit the partnership proposal we discussed last week.",
    from: "alex@partner.co",
    subject: "Re: Partnership",
    date: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "stub_thread_2",
    snippet: "[stub] Quick question on the Q2 numbers — do you have 15 min tomorrow?",
    from: "investor@vc.com",
    subject: "Q2 follow-up",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export async function listEmailThreads(input: Input): Promise<string> {
  const query = str(input.query, "newer_than:7d in:inbox");
  const maxResults = num(input.max_results, 10);

  if (isGoogleStub()) {
    return JSON.stringify({ stub_mode: true, threads: STUB_THREADS });
  }

  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", String(maxResults));
  const list = (await googleFetch(listUrl.toString())) as {
    threads?: { id: string; snippet: string }[];
  };
  return JSON.stringify({ threads: list.threads ?? [] });
}

export async function getEmailThread(input: Input): Promise<string> {
  const threadId = str(input.thread_id);
  if (!threadId) return JSON.stringify({ error: "thread_id required" });

  if (isGoogleStub()) {
    const stub = STUB_THREADS.find((t) => t.id === threadId) ?? STUB_THREADS[0];
    return JSON.stringify({
      stub_mode: true,
      thread: { ...stub, messages: [{ from: stub.from, body: stub.snippet }] },
    });
  }

  const data = await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`,
  );
  return JSON.stringify({ thread: data });
}

export async function draftEmail(input: Input): Promise<string> {
  const toRaw = Array.isArray(input.to) ? (input.to as unknown[]) : [];
  const to = toRaw.filter((x): x is string => typeof x === "string");
  const subject = str(input.subject);
  const body = str(input.body);
  if (!to.length || !subject || !body) {
    return JSON.stringify({ error: "to[], subject, body required" });
  }

  if (isGoogleStub()) {
    return JSON.stringify({
      stub_mode: true,
      draft: { id: `stub_draft_${Date.now()}`, to, subject, body },
    });
  }

  const rfc822 = [
    `To: ${to.join(", ")}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");

  const raw = Buffer.from(rfc822)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const data = (await googleFetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: {
        raw,
        threadId: str(input.in_reply_to_thread_id) || undefined,
      },
    }),
  })) as { id: string };

  return JSON.stringify({ draft: { id: data.id } });
}
