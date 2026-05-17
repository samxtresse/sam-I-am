"use client";
import { useEffect, useRef, useState } from "react";

type UIMessage = { role: "user" | "assistant"; text: string };

export function SecretaryChat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages, pending]);

  async function send(text: string) {
    setError(null);
    setPending(true);
    const nextHistory = [...messages, { role: "user" as const, text }];
    setMessages(nextHistory);

    const apiMessages = nextHistory.map((m) => ({ role: m.role, content: m.text }));
    try {
      const res = await fetch("/api/secretary/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", text: data.reply ?? "" }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    void send(text);
  }

  return (
    <div className="card flex flex-col h-[70vh]">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <EmptyHint />
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "chat-bubble chat-bubble-user ml-auto max-w-[80%] whitespace-pre-wrap"
                  : "chat-bubble mr-auto max-w-[85%] whitespace-pre-wrap"
              }
            >
              {m.text}
            </div>
          ))
        )}
        {pending ? (
          <div className="chat-bubble mr-auto max-w-[60%] text-ink-muted italic">thinking…</div>
        ) : null}
        {error ? <div className="text-loss text-xs">{error}</div> : null}
      </div>
      <form
        onSubmit={onSubmit}
        className="border-t border-cream-200 p-3 flex gap-2 items-end"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Ask anything — schedule, email, memory, todos…"
          rows={2}
          className="flex-1 resize-none rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm"
          disabled={pending}
        />
        <button type="submit" disabled={pending || !input.trim()} className="btn btn-primary">
          Send
        </button>
      </form>
    </div>
  );
}

function EmptyHint() {
  const examples = [
    "What's on my calendar tomorrow?",
    "Draft an outreach to alex@partner.co proposing 3 times next week for a 30-min call.",
    "Remember that I prefer afternoon meetings on Tuesdays.",
    "Save meeting notes: 1:1 with Jamie. We agreed I'd send the term sheet by Friday.",
  ];
  return (
    <div className="text-sm text-ink-muted space-y-2">
      <p className="font-medium text-ink">Try one of these to get started:</p>
      <ul className="list-disc pl-5 space-y-1">
        {examples.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
