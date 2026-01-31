"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streamId, setStreamId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedStreamId = localStorage.getItem("streamId");
    if (storedStreamId) {
      setStreamId(storedStreamId);
      fetch(`/api/chat?streamId=${storedStreamId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.history) {
            setMessages(data.history);
          }
          if (typeof data.totalTokens === "number") {
            setTotalTokens(data.totalTokens);
          }
        });
    } else {
      const newId = uuidv4();
      setStreamId(newId);
      localStorage.setItem("streamId", newId);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content, streamId }),
      });

      const data = await res.json();
      if (data.reply) {
        const aiMessage: Message = { role: "assistant", content: data.reply };
        setMessages((prev) => [...prev, aiMessage]);
        if (typeof data.totalTokens === "number") {
          setTotalTokens(data.totalTokens);
        }
      } else {
        console.error("No reply in response", data);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem("streamId");
    window.location.reload();
  };

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-900">EventSrc</span>
            <span className="text-xs text-gray-400 ml-2">Chatbot</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 font-mono hidden sm:inline">
            {totalTokens.toLocaleString()} tokens
          </span>
          <span className="text-xs text-gray-400 font-mono hidden sm:inline">
            {streamId.slice(0, 8)}
          </span>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-gray-50" style={{ maxHeight: "calc(100vh - 130px)" }}>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-32 select-none">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Welcome to EventSrc</h2>
              <p className="text-sm text-gray-400">Ask me anything to get started.</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              {msg.role === "user" ? (
                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-white">U</span>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
              )}

              {/* Bubble */}
              <div
                className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-2xl rounded-tr-md"
                    : "bg-white text-gray-700 rounded-2xl rounded-tl-md shadow-sm border border-gray-100"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="bg-white text-gray-400 rounded-2xl rounded-tl-md shadow-sm border border-gray-100 px-4 py-3">
                <div className="dot-loading flex items-center">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 text-sm bg-gray-100 rounded-xl border border-gray-200 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all placeholder:text-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </main>
  );
}
