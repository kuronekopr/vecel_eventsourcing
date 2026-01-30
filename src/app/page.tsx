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
    // Restore or create streamId
    const storedStreamId = localStorage.getItem("streamId");
    if (storedStreamId) {
      setStreamId(storedStreamId);
      // Fetch history
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

  // Safe reset for demo
  const handleReset = () => {
    localStorage.removeItem("streamId");
    window.location.reload();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-24 bg-gray-50">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Vecel Eventsourcing Chatbot</h1>
        <div className="flex items-center gap-4">
          <p className="text-gray-500 text-xs">Tokens: {totalTokens.toLocaleString()}</p>
          <p className="text-gray-500 text-xs">Session: {streamId}</p>
          <button onClick={handleReset} className="text-xs text-red-500 hover:underline">New Session</button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-3xl bg-white rounded-lg shadow-xl overflow-hidden flex flex-col h-[70vh]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <p>Type a message to start chatting.</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
                  }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2 text-gray-500 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
