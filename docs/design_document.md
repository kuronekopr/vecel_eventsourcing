# Software Design Document: Vecel Eventsourcing Chatbot

## 1. Introduction
本ドキュメントは、Vecel Eventsourcing Chatbotのソフトウェア設計仕様書(SDD)です。Event SourcingパターンとCQRSアーキテクチャを採用し、スケーラブルで監査可能なチャットシステムを構築します。

## 2. System Architecture

### 2.1 Overview
*   **Frontend**: React (Vite) - SPAとして構築。
*   **Backend**: Vercel Serverless Functions - APIおよびイベント処理。
*   **Database**: Neon (PostgreSQL) - データ永続化。
    *   **Autoscaling**: 負荷に応じてコンピュートリソースを自動スケール (0.25 - 8 vCPU)。
    *   **Connection Pooling**: PgBouncerによるコネクションプーリングを使用。

*   **External Service**: OpenAI API - LLM推論。

### 2.2 CQRS (Command Query Responsibility Segregation)
システムの読み取りと書き込みの責任を分離します。

*   **Command (Write Side)**:
    *   全ての状態変更は「イベント」として `events` テーブルに追記されます。
    *   更新（UPDATE）や削除（DELETE）は行いません。
*   **Query (Read Side)**:
    *   画面表示用に最適化された `conversation_states` テーブルを参照します。
    *   イベント発生時に「Projection」処理が走り、Queryモデルを最新化します。

## 3. Database Design

### 3.1 Events Table (Write Model)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK. default: `gen_random_uuid()` |
| `stream_id` | TEXT | 集約ID（Session ID）。インデックス対象。 |
| `event_type` | VARCHAR | `USER_QUERY`, `AI_RESPONSE` |
| `payload` | JSONB | イベントデータ本体（メッセージ等） |
| `meta` | JSONB | メタデータ（トークン使用量、モデル名、レイテンシ） |
| `created_at` | TIMESTAMPTZ | 発生日時 |

### 3.2 Conversation States Table (Read Model)
| Column | Type | Description |
| :--- | :--- | :--- |
| `stream_id` | TEXT | PK. |
| `last_question` | TEXT | 最新のユーザー質問 |
| `last_answer` | TEXT | 最新のAI回答 |
| `history` | JSONB | 会話履歴 `[{role, content}, ...]` |
| `total_tokens` | INTEGER | 累計トークン使用量 |
| `updated_at` | TIMESTAMPTZ | 最終更新日時 |

## 4. API Specification

### 4.1 POST /api/chat
チャットメッセージを送信し、AIの回答を取得します。

*   **Request**: `{ message: string, streamId?: string }`
*   **Process**:
    1.  `streamId` がなければ生成。
    2.  `USER_QUERY` イベントを `events` に保存。
    3.  Projection: `conversation_states` 更新。
    4.  OpenAI API 呼び出し。
    5.  `AI_RESPONSE` イベントを `events` に保存（`meta.usage` 含む）。
    6.  Projection: `conversation_states` 更新（+トークン加算）。
*   **Response**: `{ reply: string, streamId: string }`

### 4.2 GET /api/chat/:streamId
会話履歴と状態を取得します。

*   **Process**: `conversation_states` テーブルから `streamId` でSELECT。
*   **Response**: `{ history: [], total_tokens: number, last_update: string }`

## 5. Technology Stack
*   **Language**: TypeScript
*   **Framework**: React (Frontend), Next.js / Serverless (Backend)
*   **Database**: Neon (PostgreSQL) with `drizzle-orm`
*   **AI**: OpenAI API (`gpt-4o` recommended)

## 6. Implementation Notes
*   **Environment Variables**:
    *   `OPENAI_API_KEY`: 必須。
    *   `DATABASE_URL`: アプリケーション接続用 (Pooled Connection)。
    *   `DIRECT_URL`: マイグレーション実行用 (Direct Connection)。

*   **Error Handling**: OpenAI API エラー時は `SYSTEM_ERROR` イベントを記録することを推奨。
*   **Security**: API Routeの保護、Rate Limitingの実装（Vercel Config等）。
