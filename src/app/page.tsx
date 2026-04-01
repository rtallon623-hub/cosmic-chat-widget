"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, Send, Sparkles, Star, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { getChatApiUrl, sendChatMessage } from "@/lib/chat-api.mjs";

type ChatRole = "assistant" | "user" | "error";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  isPending?: boolean;
};

type ApiMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatbotPanelProps = {
  className?: string;
};

const quickPrompts = [
  "What should a cat-friendly morning routine look like?",
  "How can I tell if my cat is bored?",
  "Give me a short cosmic cat bedtime ritual.",
];

function makeId(prefix: string) {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${randomId}`;
}

function messageStyles(role: ChatRole) {
  if (role === "user") {
    return "ml-auto border border-[--glass-blue] bg-[linear-gradient(135deg,rgba(31,23,59,0.9),rgba(22,15,41,0.95))] text-[--ink-800] shadow-[0_8px_24px_rgba(0,0,0,0.4)]";
  }

  if (role === "error") {
    return "border border-rose-900/50 bg-[rgba(60,15,25,0.4)] text-rose-200";
  }

  return "border border-[--glass-gold] bg-[linear-gradient(135deg,rgba(40,24,18,0.6),rgba(20,15,30,0.8))] text-[--ink-700] shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md";
}

function MessageIcon({ role }: { role: ChatRole }) {
  if (role === "user") {
    return <UserRound className="size-3.5" aria-hidden="true" />;
  }

  return <Sparkles className="size-3.5 text-[--sun]" aria-hidden="true" />;
}

function ChatbotPanel({ className }: ChatbotPanelProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const apiUrl = getChatApiUrl();
  const hasMessages = messages.length > 0;

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({
      behavior: messages.length > 0 ? "smooth" : "auto",
      block: "end",
    });
  }, [messages, isSending]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function clearConversation() {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setDraft("");
    setErrorMessage("");
    setIsSending(false);
  }

  async function submitPrompt(prompt: string) {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt || isSending) {
      return;
    }

    setIsSending(true);
    setErrorMessage("");

    const userMessageId = makeId("user");
    const assistantMessageId = makeId("assistant");
    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content: trimmedPrompt,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "Reading the stars...",
        isPending: true,
      },
    ]);

    setDraft("");

    // Build messages array from conversation history for the API
    const apiMessages: ApiMessage[] = [
      ...messages
        .filter((m): m is ChatMessage & { role: "user" | "assistant" } =>
          m.role === "user" || (m.role === "assistant" && !m.isPending)
        )
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: trimmedPrompt },
    ];

    try {
      const result = await sendChatMessage({
        messages: apiMessages,
        signal: controller.signal,
        apiUrl,
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: result.assistantMessage,
                isPending: false,
              }
            : message
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat request failed.";

      setErrorMessage(message);
      setMessages((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId
            ? {
                id: assistantMessageId,
                role: "error",
                content: message,
              }
            : entry
        )
      );
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void submitPrompt(draft);
  }

  return (
    <section
      className={cn(
        "panel fade-up relative overflow-hidden rounded-[2rem] border border-[--line] bg-[linear-gradient(180deg,rgba(26,20,43,0.95),rgba(14,10,24,0.98))] text-[--ink-800]",
        className
      )}
    >
      <div className="relative border-b border-[--line] bg-[linear-gradient(135deg,rgba(255,183,106,0.1),rgba(126,167,255,0.05))] px-5 py-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full border border-[--line] bg-[linear-gradient(135deg,rgba(255,157,87,0.2),rgba(255,157,87,0))] text-[--sun]">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-title text-xl leading-tight text-[--ink-900]">
                Cosmic Cat Chat
              </h2>
              <p className="text-xs text-[--ink-600]">
                Your mystic feline fortune teller
              </p>
            </div>
          </div>
          {hasMessages ? (
            <button
              type="button"
              onClick={clearConversation}
              disabled={isSending}
              className="inline-flex items-center gap-1.5 rounded-full border border-[--line] bg-[--glass-panel] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[--ink-600] transition-colors hover:bg-[--glass-blue] hover:text-[--ink-900] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative p-4 md:p-5">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,157,87,0.03)_0%,transparent_60%)]" aria-hidden="true" />
        <div className="relative z-10 flex min-h-[24rem] flex-col rounded-[1.5rem] border border-[--line] bg-[rgba(12,8,22,0.6)] p-4 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] md:p-4">
          <div
            className="flex-1 space-y-4 overflow-y-auto pr-1"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={isSending}
          >
            {!hasMessages ? (
              <div className="flex min-h-[16rem] flex-col items-center justify-center space-y-6 rounded-[1.25rem] border border-dashed border-[--glass-gold] bg-[linear-gradient(180deg,rgba(255,157,87,0.05),transparent)] p-6 text-center">
                <div className="relative flex size-16 items-center justify-center rounded-full border border-[--sun] bg-[radial-gradient(circle_at_30%_30%,rgba(255,191,111,0.4),rgba(20,15,30,0.8))] shadow-[0_0_30px_rgba(255,157,87,0.2)]">
                  <Star className="size-6 text-[--sun]" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-title text-xl text-[--ink-900]">Seek Cosmic Counsel</h3>
                  <p className="mt-1 text-sm text-[--ink-600]">The stars are aligned. What is your question?</p>
                </div>
                <div className="flex w-full flex-wrap justify-center gap-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void submitPrompt(prompt)}
                      disabled={isSending}
                      className="rounded-full border border-[--line] bg-[rgba(30,22,50,0.6)] px-4 py-2 text-sm text-[--ink-700] transition-all hover:-translate-y-0.5 hover:border-[--sun] hover:text-[--ink-900] hover:shadow-[0_4px_12px_rgba(255,157,87,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex items-end gap-3", message.role === "user" && "justify-end")}
                >
                  {message.role !== "user" ? (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[--glass-gold] bg-[rgba(20,15,30,0.8)] shadow-[0_0_10px_rgba(255,157,87,0.1)]">
                      <MessageIcon role={message.role} />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-[1.25rem] px-4 py-3 text-sm leading-6 md:text-base",
                      messageStyles(message.role)
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] opacity-60">
                      <span>
                        {message.role === "user"
                          ? "You"
                          : message.role === "error"
                            ? "Error"
                            : "Cosmic cat"}
                      </span>
                      <span>{message.isPending ? "Focusing" : "Just now"}</span>
                    </div>
                    {message.isPending ? (
                      <div className="flex items-center gap-2 text-[--sun]">
                        <Star className="size-4 animate-pulse" aria-hidden="true" />
                        <span>{message.content}</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {message.role === "user" ? (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[--glass-blue] bg-[rgba(31,23,59,0.9)] text-[--ink-600]">
                      <MessageIcon role={message.role} />
                    </div>
                  ) : null}
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-[1.25rem] border border-rose-900/50 bg-[rgba(60,15,25,0.4)] px-4 py-3 text-sm leading-6 text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-4">
            <label className="sr-only" htmlFor="cat-chat-draft">
              Message the cosmic cat
            </label>
            <div className="relative flex items-center">
              <textarea
                id="cat-chat-draft"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the stars..."
                rows={1}
                disabled={isSending}
                className="max-h-32 min-h-12 w-full resize-none rounded-full border border-[--line] bg-[rgba(20,15,35,0.8)] py-3 pl-5 pr-14 text-sm leading-6 text-[--ink-900] outline-none ring-[--sun] placeholder:text-[--ink-600] transition-colors focus:bg-[rgba(30,22,50,0.9)] focus:ring-1 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={!draft.trim() || isSending}
                className="absolute right-2 flex size-8 items-center justify-center rounded-full bg-[--sun] text-amber-950 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {isSending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4 ml-0.5" aria-hidden="true" />
                )}
                <span className="sr-only">Send</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <main className="h-screen w-screen bg-transparent p-0 m-0">
      <ChatbotPanel className="h-full w-full rounded-none md:rounded-none border-none shadow-none m-0 max-w-none" />
    </main>
  );
}
