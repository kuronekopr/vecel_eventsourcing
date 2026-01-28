import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { appendEvent, getConversationState } from "@/lib/events";
import { generateChatResponse, ChatMessage } from "@/lib/openai";

/**
 * POST /api/chat
 * Body: { message: string, streamId?: string }
 * Returns: { streamId, reply, usage }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, streamId: existingStreamId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const streamId = existingStreamId || uuidv4();

    // 1. Record USER_QUERY event
    await appendEvent(streamId, "USER_QUERY", { content: message });

    // 2. Build conversation history from read model
    const state = await getConversationState(streamId);
    const history: ChatMessage[] = state?.history
      ? (state.history as ChatMessage[])
      : [{ role: "user", content: message }];

    // 3. Call OpenAI
    const aiResponse = await generateChatResponse([
      {
        role: "system",
        content:
          "You are a helpful assistant. Answer concisely and accurately.",
      },
      ...history,
    ]);

    // 4. Record AI_RESPONSE event
    await appendEvent(
      streamId,
      "AI_RESPONSE",
      { content: aiResponse.content },
      {
        model: aiResponse.model,
        prompt_tokens: aiResponse.usage?.prompt_tokens ?? 0,
        completion_tokens: aiResponse.usage?.completion_tokens ?? 0,
        total_tokens: aiResponse.usage?.total_tokens ?? 0,
      }
    );

    return NextResponse.json({
      streamId,
      reply: aiResponse.content,
      usage: aiResponse.usage,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat?streamId=xxx
 * Returns the conversation state from the read model (CQRS Query side).
 */
export async function GET(request: NextRequest) {
  const streamId = request.nextUrl.searchParams.get("streamId");

  if (!streamId) {
    return NextResponse.json(
      { error: "streamId is required" },
      { status: 400 }
    );
  }

  try {
    const state = await getConversationState(streamId);

    if (!state) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(state);
  } catch (error) {
    console.error("Chat GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
