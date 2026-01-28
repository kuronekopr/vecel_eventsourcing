-- Event Sourcing: events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id TEXT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_stream_id ON events(stream_id);

-- CQRS Read Model: conversation_states table
CREATE TABLE IF NOT EXISTS conversation_states (
  stream_id TEXT PRIMARY KEY,
  last_question TEXT,
  last_answer TEXT,
  history JSONB DEFAULT '[]'::jsonb,
  total_tokens INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
