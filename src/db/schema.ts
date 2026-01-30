import { pgTable, text, varchar, timestamp, jsonb, integer, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Write Model: events
export const events = pgTable("events", {
    id: uuid("id").defaultRandom().primaryKey(),
    streamId: text("stream_id").notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    meta: jsonb("meta").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => {
    return {
        streamIdIdx: index("idx_events_stream_id").on(table.streamId),
    };
});

// Read Model: conversation_states
export const conversationStates = pgTable("conversation_states", {
    streamId: text("stream_id").primaryKey(),
    lastQuestion: text("last_question"),
    lastAnswer: text("last_answer"),
    history: jsonb("history").default(sql`'[]'::jsonb`),
    totalTokens: integer("total_tokens").default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
