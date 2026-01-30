import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { appendEvent, getConversationState } from "@/lib/events";
import { v4 as uuidv4 } from "uuid";

// POST /api/chat
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, streamId: requestStreamId } = body;

    // Ensure streamId exists or create new
    const streamId = requestStreamId || uuidv4();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Log User Query (Command)
    await appendEvent(streamId, "USER_QUERY", { content: message });

    // 2. Call OpenAI (with history from read model)
    const state = await getConversationState(streamId);
    const history = (state?.history as any[]) || [];

    // Prepare messages for OpenAI (System prompt + History + New Message)
    const messages = [
      { role: "system", content: "You are a helpful AI assistant." },
      ...history.map((msg: any) => ({ role: msg.role, content: msg.content })),
      // Note: History update in appendEvent pushes the new user message, so 'state.history' already contains it?
      // Let's check events.ts logic. 
      // appendEvent updates history in conversationStates immediately.
      // So 'state' fetched above *should* contain the latest user message if consistency is strong.
      // However, to be safe and explicit, let's just use the history from DB which mirrors the chat flow.
    ];

    // If appendEvent updated the DB, 'state' fetched *after* it should have the user message.
    // Let's allow for slight delay or just verify logic.
    // Actually, appendEvent is awaited, so DB should be updated.

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      stream: false, // Usage capture is easier with non-streaming for v1
    });

    const reply = completion.choices[0].message.content || "";
    const usage = completion.usage;

    // 3. Log AI Response (Command)
    const { totalTokens } = await appendEvent(streamId, "AI_RESPONSE", { content: reply }, { usage });

    return NextResponse.json({ reply, streamId, totalTokens });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

// GET /api/chat?streamId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("streamId");

  if (!streamId) {
    return NextResponse.json({ error: "streamId is required" }, { status: 400 });
  }

  const state = await getConversationState(streamId);
  return NextResponse.json(state || { history: [], totalTokens: 0 });
}
