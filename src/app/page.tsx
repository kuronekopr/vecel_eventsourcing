"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, streamId }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data: { streamId: string; reply: string; usage: Usage | null } =
        await res.json();

      if (!streamId) {
        setStreamId(data.streamId);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);

      if (data.usage) {
        setTotalTokens((prev) => prev + data.usage!.total_tokens);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error: Failed to get response. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-background/80 backdrop-blur dark:border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Event Sourcing Chatbot</h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            {streamId && (
              <span className="hidden sm:inline">
                Session: {streamId.slice(0, 8)}...
              </span>
            )}
            {totalTokens > 0 && <span>Tokens: {totalTokens}</span>}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-zinc-400">
              Send a message to start the conversation.
              <br />
              <span className="text-xs">
                All interactions are stored as events (Event Sourcing + CQRS).
              </span>
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce [animation-delay:0.2s]">.</span>
                <span className="animate-bounce [animation-delay:0.4s]">.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="sticky bottom-0 border-t border-black/10 bg-background/80 backdrop-blur dark:border-white/10">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-black/10 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:opacity-50 dark:border-white/10 dark:focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
