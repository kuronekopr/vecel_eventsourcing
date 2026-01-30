CREATE TABLE "conversation_states" (
	"stream_id" text PRIMARY KEY NOT NULL,
	"last_question" text,
	"last_answer" text,
	"history" jsonb DEFAULT '[]'::jsonb,
	"total_tokens" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" text NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_events_stream_id" ON "events" USING btree ("stream_id");