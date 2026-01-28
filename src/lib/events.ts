import { getDb } from "./db";

export type EventType = "USER_QUERY" | "AI_RESPONSE";

export interface ChatEvent {
  id: string;
  stream_id: string;
  event_type: EventType;
  payload: Record<string, unknown>;
  meta: Record<string, unknown>;
  created_at: string;
}

/**
 * Append an event to the event store and update the read model (projection).
 */
export async function appendEvent(
  streamId: string,
  eventType: EventType,
  payload: Record<string, unknown>,
  meta: Record<string, unknown> = {}
): Promise<void> {
  const sql = getDb();

  // 1. Insert event (Command / Write side)
  await sql`
    INSERT INTO events (stream_id, event_type, payload, meta)
    VALUES (${streamId}, ${eventType}, ${JSON.stringify(payload)}, ${JSON.stringify(meta)})
  `;

  // 2. Update read model (Projection)
  if (eventType === "USER_QUERY") {
    const content = payload.content as string;
    const newEntry = JSON.stringify({ role: "user", content });

    await sql`
      INSERT INTO conversation_states (stream_id, last_question, history, updated_at)
      VALUES (
        ${streamId},
        ${content},
        jsonb_build_array(${newEntry}::jsonb),
        NOW()
      )
      ON CONFLICT (stream_id) DO UPDATE SET
        last_question = ${content},
        history = conversation_states.history || ${newEntry}::jsonb,
        updated_at = NOW()
    `;
  } else if (eventType === "AI_RESPONSE") {
    const content = payload.content as string;
    const tokens = (meta.total_tokens as number) || 0;
    const newEntry = JSON.stringify({ role: "assistant", content });

    await sql`
      INSERT INTO conversation_states (stream_id, last_answer, history, total_tokens, updated_at)
      VALUES (
        ${streamId},
        ${content},
        jsonb_build_array(${newEntry}::jsonb),
        ${tokens},
        NOW()
      )
      ON CONFLICT (stream_id) DO UPDATE SET
        last_answer = ${content},
        history = conversation_states.history || ${newEntry}::jsonb,
        total_tokens = conversation_states.total_tokens + ${tokens},
        updated_at = NOW()
    `;
  }
}

/**
 * Query the read model for a conversation's current state.
 */
export async function getConversationState(streamId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM conversation_states WHERE stream_id = ${streamId}
  `;
  return rows[0] || null;
}
