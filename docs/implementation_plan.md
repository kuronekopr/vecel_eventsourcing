# 実装計画: Vecel Eventsourcing Chatbot

このドキュメントは、プロジェクトの設計と実装状況を記録したものです。ReactベースのチャットボットをVercelにデプロイし、OpenAIと連携させ、全てのインタラクションをイベントソーシングとしてNeon (PostgreSQL) に保存します。

## 1. アーキテクチャ概要

*   **Frontend**: Next.js 16 App Router (React 19, Tailwind CSS 4)
    *   ユーザーインターフェース: チャットボット画面。
    *   セッション管理: `localStorage` による `streamId` の永続化。
*   **Backend**: Next.js API Routes (`src/app/api/`)
    *   OpenAIへのプロキシ。
    *   イベントの記録（Event Sourcing）。
*   **Database**: Neon (Serverless PostgreSQL)
    *   **パターン**: Event Sourcing + CQRS（状態の更新ではなく、イベントの追記）。
    *   **ORM**: Drizzle ORM (`drizzle-orm` + `drizzle-kit`)。
    *   **保存内容**: ユーザーの質問、AIの応答（トークン使用量を含む）。
*   **External Integration**:
    *   OpenAI API (GPT-4o)。

## 2. ディレクトリ構造

```
/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts       # POST /api/chat, GET /api/chat?streamId=
│   │   ├── globals.css             # Tailwind CSS グローバルスタイル
│   │   ├── layout.tsx              # ルートレイアウト (メタデータ, フォント)
│   │   └── page.tsx                # チャットUI (Client Component)
│   ├── db/
│   │   └── schema.ts              # Drizzle ORM スキーマ定義
│   └── lib/
│       ├── db.ts                  # Neon DB接続 (Drizzle経由)
│       ├── events.ts              # Event Sourcing コアロジック (appendEvent, getConversationState)
│       └── openai.ts              # OpenAI クライアント
├── scripts/
│   └── migrate.sql                # テーブル作成SQL (手動実行用)
├── drizzle/                        # Drizzle マイグレーション出力先
├── drizzle.config.ts               # Drizzle Kit 設定
├── .env.example                    # 環境変数テンプレート
├── package.json
└── tsconfig.json
```

## 3. データベーススキーマ (Event Sourcing)

Neon (PostgreSQL) に2つのテーブルを作成します。スキーマは `src/db/schema.ts` で Drizzle ORM により定義されています。

### Table: `events` (Write Model / Event Store)

| カラム名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `id` | UUID | プライマリキー (`defaultRandom()`) |
| `stream_id` | TEXT NOT NULL | セッションIDまたは会話ID |
| `event_type` | VARCHAR(50) NOT NULL | `USER_QUERY`, `AI_RESPONSE`, `SYSTEM_ERROR` |
| `payload` | JSONB NOT NULL | メッセージ内容 `{content: string}` |
| `meta` | JSONB | トークン使用量 `{usage: {prompt_tokens, completion_tokens, total_tokens}}`、モデル名など |
| `created_at` | TIMESTAMPTZ | 作成日時 (`DEFAULT NOW()`) |

**インデックス**: `idx_events_stream_id` ON `stream_id`

### Table: `conversation_states` (Read Model / Query)

CQRSパターンに基づき、読み取り専用の最適化されたテーブル。イベント発生時にリアルタイムで更新（Projection）されます。

| カラム名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `stream_id` | TEXT PRIMARY KEY | セッションID |
| `last_question` | TEXT | 最終質問内容 |
| `last_answer` | TEXT | 最終回答内容 |
| `history` | JSONB | 全会話ログ配列 `[{role: 'user', content: '...'}, ...]` |
| `total_tokens` | INTEGER | トークン使用量累計 (DEFAULT 0) |
| `updated_at` | TIMESTAMPTZ | 最終更新日時 |

## 4. データフローと処理ロジック (CQRS)

### 4.1 Command (Write) — `POST /api/chat`

```
ユーザー入力
  → appendEvent(streamId, "USER_QUERY", {content})
    → events テーブルへ INSERT
    → conversation_states を UPSERT (last_question 更新, history に追記)
  → OpenAI API 呼び出し (gpt-4o, 会話履歴付き)
  → appendEvent(streamId, "AI_RESPONSE", {content}, {usage})
    → events テーブルへ INSERT
    → conversation_states を UPSERT (last_answer 更新, history に追記, total_tokens 加算)
  → レスポンス返却 {reply, streamId, totalTokens}
```

### 4.2 Projection (同期)

`appendEvent` 関数内で同期的に実行。イベント保存直後に `conversation_states` を UPSERT します。

*   **`USER_QUERY` 受信時**: `last_question` を更新、`history` にユーザーメッセージを追記。
*   **`AI_RESPONSE` 受信時**: `last_answer` を更新、`history` にアシスタントメッセージを追記、`total_tokens` に `meta.usage.total_tokens` を加算。

### 4.3 Query (Read) — `GET /api/chat?streamId=`

`conversation_states` テーブルを単純に SELECT します。`events` テーブルの集計は不要で、高速なレスポンスが可能です。フロントエンドはページ読み込み時にこのエンドポイントから会話履歴を復元します。

## 5. 実装状況

### Phase 1: 環境構築 ✅ 完了
*   Next.js 16 App Router プロジェクト (TypeScript, Tailwind CSS 4)。
*   依存ライブラリ: `openai`, `@neondatabase/serverless`, `drizzle-orm`, `uuid`。
*   開発用ツール: `drizzle-kit`, `@types/uuid`。
*   環境変数テンプレート (`.env.example`):
    *   `OPENAI_API_KEY` — OpenAI APIキー
    *   `DATABASE_URL` — Neon Pooled 接続文字列 (アプリケーション用)
    *   `DIRECT_URL` — Neon Direct 接続文字列 (マイグレーション用)

### Phase 2: データベース実装 ✅ 完了
*   Drizzle ORM によるスキーマ定義 (`src/db/schema.ts`)。
*   `drizzle.config.ts` によるマイグレーション設定 (`DIRECT_URL` 優先)。
*   手動実行用SQLスクリプト (`scripts/migrate.sql`)。
*   Neon接続ヘルパー (`src/lib/db.ts`) — `neon()` + `drizzle()` による接続。

### Phase 3: バックエンド実装 (API) ✅ 完了
*   `POST /api/chat` — メッセージ送信、イベント記録、OpenAI呼び出し、応答返却。
*   `GET /api/chat?streamId=` — 会話状態の読み取り (CQRS Query)。
*   `src/lib/events.ts` — `appendEvent()` (Write + Projection) / `getConversationState()` (Read)。
*   `src/lib/openai.ts` — OpenAI クライアントインスタンス。

### Phase 4: フロントエンド実装 ✅ 完了
*   チャットUI (`src/app/page.tsx`) — Client Component。
*   `localStorage` による `streamId` 永続化 (ページリロード後も会話継続)。
*   ページ読み込み時に `GET /api/chat` から会話履歴を復元。
*   トークン使用量のリアルタイム表示。
*   「New Session」ボタンによるセッションリセット機能。
*   ローディング表示 (Thinking... アニメーション)。
*   自動スクロール。

## 6. 技術的制約・要件
*   **ログの完全性**: AIの回答だけでなく、トークン使用量 (`usage` オブジェクト) を `meta` カラムに記録すること（コスト管理のため重要）。
*   **PostgreSQL互換**: Neon を使用するため、`@neondatabase/serverless` ドライバを使用。
*   **Drizzle ORM**: 型安全なDB操作。スキーマは `src/db/schema.ts` で一元管理。
*   **非ストリーミング**: OpenAI呼び出しは `stream: false` で実行。`usage` オブジェクトの取得を確実にするため。
*   **接続文字列の使い分け**: アプリケーションは `DATABASE_URL` (Pooled)、マイグレーションは `DIRECT_URL` (Direct) を使用。

## 7. セットアップ手順

1.  `.env.example` をコピーして `.env.local` を作成し、`OPENAI_API_KEY`、`DATABASE_URL`、`DIRECT_URL` を設定。
2.  Neon コンソールで `scripts/migrate.sql` を実行、または `npx drizzle-kit push` でスキーマを反映。
3.  `npm run dev` で開発サーバーを起動。
4.  http://localhost:3000 にアクセス。
