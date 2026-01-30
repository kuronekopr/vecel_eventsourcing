import { getDb } from "./db";
import { events, conversationStates } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export type EventType = "USER_QUERY" | "AI_RESPONSE" | "SYSTEM_ERROR";

export async function appendEvent(
  streamId: string,
  eventType: EventType,
  payload: any,
  meta: any = {}
) {
  const db = getDb();

  // 1. Write to Events Table (Command)
  await db.insert(events).values({
    streamId,
    eventType,
    payload,
    meta,
  });

  // 2. Update Read Model (Projection)
  // Fetch current state or defaults
  const currentState = await db
    .select()
    .from(conversationStates)
    .where(eq(conversationStates.streamId, streamId))
    .then((res) => res[0]);

  let history = (currentState?.history as any[]) || [];
  let totalTokens = currentState?.totalTokens || 0;
  let lastQuestion = currentState?.lastQuestion;
  let lastAnswer = currentState?.lastAnswer;

  if (eventType === "USER_QUERY") {
    lastQuestion = payload.content || payload.text;
    history.push({ role: "user", content: lastQuestion });
  } else if (eventType === "AI_RESPONSE") {
    lastAnswer = payload.content || payload.text;
    history.push({ role: "assistant", content: lastAnswer });
    // Add tokens if available in meta.usage
    if (meta?.usage?.total_tokens) {
      totalTokens += meta.usage.total_tokens;
    }
  }

  // Upsert Conversation State
  await db
    .insert(conversationStates)
    .values({
      streamId,
      lastQuestion,
      lastAnswer,
      history,
      totalTokens,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: conversationStates.streamId,
      set: {
        lastQuestion,
        lastAnswer,
        history,
        totalTokens,
        updatedAt: new Date(),
      },
    });

  return { streamId };
}

export async function getConversationState(streamId: string) {
  const db = getDb();
  const state = await db
    .select()
    .from(conversationStates)
    .where(eq(conversationStates.streamId, streamId))
    .then((res) => res[0]);

  return state || null;
}
