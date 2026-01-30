# 実装計画: Vecel Eventsourcing Chatbot

このドキュメントは、Claude Code（または開発者）が実行するための詳細な設計図です。ReactベースのチャットボットをVercelにデプロイし、OpenAIと連携させ、全てのインタラクションをイベントソーシングとしてNeon (PostgreSQL) に保存します。

## 1. アーキテクチャ概要

*   **Frontend**: React (Vite)
    *   ユーザーインターフェース: チャットボット画面。
*   **Backend**: Vercel Serverless Functions / Next.js API Routes
    *   OpenAIへのプロキシ。
    *   イベントの記録（Event Sourcing）。
*   **Database**: Neon (Serverless PostgreSQL)
    *   **パターン**: Event Sourcing（状態の更新ではなく、イベントの追記）。
    *   **保存内容**: ユーザーの質問、AIの応答（トークン使用量を含む）。
    *   **設定**: Autoscaling有効化 (0.25 vCPU 〜)、Pooling有効化。

*   **External Integration**:
    *   OpenAI API (GPT-4o / GPT-3.5-turbo 等)。

## 2. ディレクトリ構造 (推奨)

```
/
├── client/                 # Frontend (Vite + React)
├── server/                 # Backend (Vercel Functions)
├── docs/                   # Documentation
└── README.md
```
*(または、Vercelとの親和性が高い Next.js App Router を採用し、`app/api` と `app/page.tsx` で完結させる構成も推奨されます。以下は Next.js を使用する場合の標準的な構成を想定します。)*

## 3. データベーススキーマ (Event Sourcing)

Neon (PostgreSQL) に `events` テーブルを作成します。

### Table: `events`

| カラム名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `id` | UUID | プライマリキー (gen_random_uuid()) |
| `stream_id` | UUID/VARCHAR | セッションIDまたは会話ID |
| `event_type` | VARCHAR | `USER_QUERY`, `AI_RESPONSE` |
| `payload` | JSONB | メッセージ内容などのデータ本体 |
| `meta` | JSONB | トークン使用量 (prompt_tokens, completion_tokens)、モデル名など |
| `created_at` | TIMESTAMP | 作成日時 (DEFAULT NOW()) |

**SQL定義**:
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id TEXT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stream_id ON events(stream_id);
```

### Table: `conversation_states` (Read Model / Query)

CQRSパターンに基づき、読み取り専用の最適化されたテーブルを用意します。イベントが発生するたびに、このテーブルを更新（Projection）します。

| カラム名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `stream_id` | TEXT PRIMARY KEY | セッションID |
| `last_question` | TEXT | 最終質問内容 |
| `last_answer` | TEXT | 最終回答内容 |
| `history` | JSONB | 全会話ログ配列 `[{role: 'user', content: '...'}, ...]` |
| `total_tokens` | INTEGER | トークン使用量累計 |
| `updated_at` | TIMESTAMP | 最終更新日時 |

**SQL定義**:
```sql
CREATE TABLE conversation_states (
  stream_id TEXT PRIMARY KEY,
  last_question TEXT,
  last_answer TEXT,
  history JSONB DEFAULT '[]'::jsonb,
  total_tokens INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 4. データフローと処理ロジック (CQRS)

1.  **Command (Write)**:
    *   ユーザー入力時: `events` テーブルへ `USER_QUERY` イベントをINSERT。
    *   AI応答時: `events` テーブルへ `AI_RESPONSE` イベントをINSERT。

2.  **Projection (Sync/Async)**:
    *   イベント保存直後、`conversation_states` テーブルを更新（Upsert）します。
    *   **更新ロジック**:
        *   `USER_QUERY` 受信時: `last_question` を更新、`history` に追記。
        *   `AI_RESPONSE` 受信時: `last_answer` を更新、`history` に追記、`total_tokens` に今回の `usage` を加算。

3.  **Query (Read)**:
    *   画面表示用API (`GET /api/chat/:streamId`) は、`events` テーブルを集計するのではなく、**`conversation_states` テーブルを単純にSELECT** します。これにより高速なレスポンスが可能になります。


## 5. 実装ステップ (Claude Code への指示)

### Phase 1: 環境構築
1.  **プロジェクト初期化**:
    *   Vite (React) または Next.js プロジェクトの作成。
2.  **ライブラリインストール**:
    *   `openai`, `@neondatabase/serverless` (または `pg`), `dotenv`。
3.  **環境変数の設定**:
    *   `OPENAI_API_KEY`
    *   `DATABASE_URL`: Connection Pooler経由の接続文字列（アプリ用）
    *   `DIRECT_URL`: 直接接続の文字列（マイグレーション用）



### Phase 2: データベース実装
1.  Neonへの接続設定。
2.  テーブル作成スクリプトの実行（SQL）。

### Phase 3: バックエンド実装 (API)
1.  `/api/chat` エンドポイントの作成。
2.  OpenAI APIクライアントの実装。
3.  イベントロギング関数の実装（非同期でDBへINSERT）。
    *   注意: Vercel Functionsの場合、レスポンス返却後にDB接続が切れる可能性があるため、`waitUntil` (Next.js / Cloudflare) の使用や、レスポンス前の `await` を適切に行うこと。

### Phase 4: フロントエンド実装
1.  チャットUIコンポーネントの作成。
2.  APIとの通信処理。
3.  メッセージ履歴の表示管理。

## 6. 技術的制約・要件
*   **ログの完全性**: AIの回答だけでなく、トークン使用量を必ず記録すること（コスト管理のため重要）。
*   **PostgreSQL互換**: Neonを使用するため、Postgres互換のドライバを使用すること。
