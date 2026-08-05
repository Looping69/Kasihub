"use client";

// Author: Klaasvaakie ( |╲ )
import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, MessageCircle, Send, ShieldCheck, X } from "lucide-react";
import {
  PUBLIC_ASSISTANT_SUGGESTIONS,
  answerPublicQuestion,
  splitPublicAnswerForStreaming,
  type PublicAssistantAnswer,
} from "@/lib/public-assistant";

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
  source?: string;
  streaming?: boolean;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 0,
  role: "assistant",
  text:
    "Hello. I answer verified public questions about KaSiHub, its features, and getting started. I cannot access accounts or handle personal information.",
};

export function PublicAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isStreaming, setIsStreaming] = useState(false);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingRef = useRef(false);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(
    () => () => {
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
    },
    [],
  );

  function addExchange(prompt: string, answer: PublicAssistantAnswer) {
    const userId = nextId.current++;
    const answerId = nextId.current++;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setMessages((current) => [
        ...current,
        { id: userId, role: "user", text: prompt },
        { id: answerId, role: "assistant", text: answer.message, source: answer.source },
      ]);
      return;
    }

    const chunks = splitPublicAnswerForStreaming(answer.message);
    if (chunks.length === 0) return;

    streamingRef.current = true;
    setIsStreaming(true);
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", text: prompt },
      {
        id: answerId,
        role: "assistant",
        text: "",
        source: answer.source,
        streaming: true,
      },
    ]);

    let chunkIndex = 0;
    const revealNextChunk = () => {
      const chunk = chunks[chunkIndex];
      chunkIndex += 1;
      const finished = chunkIndex === chunks.length;

      setMessages((current) =>
        current.map((message) =>
          message.id === answerId
            ? { ...message, text: `${message.text}${chunk}`, streaming: !finished }
            : message,
        ),
      );

      if (finished) {
        streamingRef.current = false;
        setIsStreaming(false);
        streamTimerRef.current = null;
        return;
      }

      streamTimerRef.current = setTimeout(revealNextChunk, 32);
    };

    streamTimerRef.current = setTimeout(revealNextChunk, 180);
  }

  function ask(prompt: string) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || streamingRef.current) return;
    addExchange(cleanPrompt, answerPublicQuestion(cleanPrompt));
    setQuestion("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          aria-label="KaSiHub public information assistant"
          className="flex h-[min(36rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-blue-200/70 bg-background/98 shadow-2xl shadow-blue-950/30 backdrop-blur-xl dark:border-blue-900"
          role="dialog"
        >
          <header className="flex items-start gap-3 bg-gradient-to-r from-[#075bb8] to-[#087fe8] px-4 py-4 text-white">
            <div className="mt-0.5 rounded-xl bg-white/15 p-2">
              <Bot aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">KasiBuddy</h2>
              <p className="text-xs text-blue-100">Verified public information only</p>
            </div>
            <button
              aria-label="Close KaSiHub assistant"
              className="rounded-lg p-2 text-blue-100 transition hover:bg-white/15 hover:text-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </header>

          <div className="flex items-start gap-2 border-b border-border bg-blue-50/80 px-4 py-3 text-xs leading-relaxed text-blue-950 dark:bg-blue-950/25 dark:text-blue-100">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#087fe8]" />
            <p>Do not share passwords, ID numbers, banking details, or other personal information.</p>
          </div>

          <div
            aria-busy={isStreaming}
            aria-label="KaSiHub conversation"
            aria-live="polite"
            className="scrollbar-kasi flex-1 space-y-3 overflow-y-auto px-4 py-4"
            ref={logRef}
            role="log"
          >
            {messages.map((message) => (
              <div
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md bg-[#075bb8] px-3.5 py-2.5 text-sm leading-relaxed text-white"
                      : "max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-muted/65 px-3.5 py-2.5 text-sm leading-relaxed text-foreground"
                  }
                >
                  <p>
                    {message.text}
                    {message.streaming && (
                      <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse font-black text-[#087fe8]">
                        ▍
                      </span>
                    )}
                  </p>
                  {message.source && !message.streaming && (
                    <p className="mt-2 border-t border-current/10 pt-2 text-[10px] font-semibold opacity-65">
                      Source: {message.source}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {PUBLIC_ASSISTANT_SUGGESTIONS.map((suggestion) => (
                <button
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-left text-xs font-semibold text-blue-900 transition hover:border-[#087fe8] hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100"
                  disabled={isStreaming}
                  key={suggestion}
                  onClick={() => ask(suggestion)}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form className="border-t border-border bg-card p-3" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="kasihub-public-question">
              Ask a public question about KaSiHub
            </label>
            <div className="flex items-center gap-2">
              <input
                autoComplete="off"
                className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-[#087fe8] focus:ring-2 focus:ring-[#087fe8]/20"
                id="kasihub-public-question"
                maxLength={240}
                disabled={isStreaming}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={isStreaming ? "KaSiHub is answering…" : "Ask about KaSiHub…"}
                ref={inputRef}
                value={question}
              />
              <button
                aria-label="Send question"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#ff9d13] to-[#ff641e] text-white shadow transition hover:from-[#ffad32] hover:to-[#ff7435] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isStreaming || !question.trim()}
                type="submit"
              >
                <Send aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <a
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#075bb8] hover:underline dark:text-blue-300"
              href="mailto:support@kasihub.co.za"
            >
              Need private support? Email the KaSiHub team
              <ExternalLink aria-hidden="true" className="h-3 w-3" />
            </a>
          </form>
        </section>
      )}

      <button
        aria-expanded={open}
        aria-label={open ? "Close KasiBuddy" : "Open KasiBuddy"}
        className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#075bb8] to-[#087fe8] px-4 py-3 font-bold text-white shadow-xl shadow-blue-950/30 transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9d13] focus-visible:ring-offset-2"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <MessageCircle aria-hidden="true" className="h-5 w-5 transition group-hover:scale-110" />
        <span>KasiBuddy</span>
      </button>
    </div>
  );
}
