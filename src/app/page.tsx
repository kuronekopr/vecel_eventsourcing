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

  const timestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "#0c0c0c" }}>
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b select-none"
        style={{ background: "#111", borderColor: "#2a2a2a" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: isLoading ? "#facc15" : "#4ade80" }}
          />
          <span className="text-sm font-bold tracking-wider uppercase" style={{ color: "#e5e5e5" }}>
            EVENTSRC
          </span>
          <span className="text-xs" style={{ color: "#525252" }}>
            //chatbot
          </span>
        </div>
        <div className="flex items-center gap-5 text-xs" style={{ color: "#525252", fontFamily: "var(--font-geist-mono), monospace" }}>
          <span>
            TKN <span style={{ color: "#a3a3a3" }}>{totalTokens.toLocaleString()}</span>
          </span>
          <span className="hidden sm:inline">
            SID <span style={{ color: "#a3a3a3" }}>{streamId.slice(0, 8)}</span>
          </span>
          <button
            onClick={handleReset}
            className="px-2 py-1 text-xs uppercase tracking-wide border transition-colors cursor-pointer"
            style={{
              color: "#a3a3a3",
              borderColor: "#2a2a2a",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#525252";
              e.currentTarget.style.color = "#e5e5e5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2a2a";
              e.currentTarget.style.color = "#a3a3a3";
            }}
          >
            Reset
          </button>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(100vh - 120px)" }}>
        <div className="max-w-3xl mx-auto space-y-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-32 select-none">
              <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#2a2a2a" }}>
                --- session start ---
              </div>
              <div className="text-sm" style={{ color: "#525252" }}>
                Ready. Type a message below.
              </div>
            </div>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className="py-2 px-3 border-l-2"
              style={{
                borderColor: msg.role === "user" ? "#525252" : "#2a2a2a",
                animation: "fadein 0.15s ease-out",
              }}
            >
              <div className="flex items-baseline gap-3 mb-1">
                <span
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: msg.role === "user" ? "#a3a3a3" : "#4ade80", minWidth: "28px" }}
                >
                  {msg.role === "user" ? "YOU" : "SYS"}
                </span>
                <span className="text-xs" style={{ color: "#2a2a2a" }}>
                  {timestamp()}
                </span>
              </div>
              <div
                className="text-sm whitespace-pre-wrap pl-10 leading-relaxed"
                style={{ color: msg.role === "user" ? "#d4d4d4" : "#a3a3a3" }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div
              className="py-2 px-3 border-l-2"
              style={{ borderColor: "#facc15" }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#facc15" }}>
                  SYS
                </span>
                <span className="text-sm flex items-center gap-1" style={{ color: "#525252" }}>
                  processing
                  <span style={{ animation: "blink 1s step-end infinite" }}>_</span>
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t px-5 py-3" style={{ borderColor: "#2a2a2a", background: "#111" }}>
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <div className="flex items-center text-xs mr-1" style={{ color: "#525252" }}>
            {">"}
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="..."
            className="flex-1 px-3 py-2 text-sm border-none outline-none"
            style={{
              background: "#161616",
              color: "#d4d4d4",
              caretColor: "#4ade80",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-2 text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer disabled:cursor-not-allowed"
            style={{
              background: input.trim() && !isLoading ? "#e5e5e5" : "transparent",
              color: input.trim() && !isLoading ? "#0c0c0c" : "#2a2a2a",
              borderColor: input.trim() && !isLoading ? "#e5e5e5" : "#2a2a2a",
            }}
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
