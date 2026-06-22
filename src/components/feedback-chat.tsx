import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Conversational feedback capture (#2). A lightweight chat modal that posts the
 * running transcript to /api/feedback-chat each turn (non-streaming) and shows
 * the assistant's reply. When the assistant creates a post, surfaces a link.
 */
export function FeedbackChat({
  slug,
  onClose,
  onCreated,
}: {
  slug: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: t("chat.greeting") },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, slug, locale: i18n.language }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const code = body?.error?.code as string | undefined;
        if (code?.startsWith("ai_")) throw new Error(t(`aiErrors.${code.slice(3)}`));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data: { reply: string; createdPostId?: string } = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply || "…" }]);
      if (data.createdPostId) setCreatedId(data.createdPostId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[600px] max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-border bg-surface shadow-lifted"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ai text-background text-[10px] font-bold">
              AI
            </span>
            <h2 className="font-display text-lg font-medium tracking-tight">{t("chat.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm"
            aria-label={t("common.cancel")}
          >
            ✕
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-background border border-border"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border bg-background px-3.5 py-2 text-sm text-muted-foreground">
                {t("chat.thinking")}
              </div>
            </div>
          )}
          {createdId && (
            <div className="rounded-2xl border border-status-done/40 bg-status-done/10 px-3.5 py-3 text-sm">
              <p className="font-medium">{t("chat.created")}</p>
              <Link
                to="/$slug/posts/$id"
                params={{ slug, id: createdId }}
                className="text-primary hover:underline"
                onClick={onCreated}
              >
                {t("chat.viewPost")} →
              </Link>
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <form onSubmit={send} className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(e);
                }
              }}
              rows={1}
              placeholder={t("chat.placeholder")}
              className="flex-1 resize-none rounded-xl border border-border-strong bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-xl bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
            >
              {t("chat.send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
