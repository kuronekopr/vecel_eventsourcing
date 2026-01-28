# システムアーキテクチャ設計書 (System Architecture & Implementation Plan)

このドキュメントは、Claude Code（または他の開発エージェント）がシステムを実装するための詳細な設計図です。

## 1. 概要 (Overview)
- **目的**: イベントソーシングを用いたチャットボットシステムの構築。
- **フロントエンド**: React (SPA) - チャット画面。
- **バックエンド**: Cloudflare Workers - APIゲートウェイ & ビジネスロジック。
- **AI**: OpenAI API。
- **データベース**: PostgreSQL (Cloudflare Workersからの接続) - イベントストア。
- **アーキテクチャ**: イベントソーシング (Event Sourcing) - 全てのやり取りをイベントとして追記保存。

## 2. アーキテクチャ構成 (Architecture)

### 2.1 技術スタック
- **Frontend**:
  - React (Vite)
  - TailwindCSS (スタイリング)
  - Lucide React (アイコン)
- **Backend**:
  - Cloudflare Workers (TypeScript)
  - `openai` npm package
- **Database**:
  - PostgreSQL (Supabase, Neon, または Hyperdrive対応のPostgres)

### 2.2 データフロー (Data Flow)
1. **User**: React UIからメッセージを送信。
2. **React**: Cloudflare Workerの `/api/chat` エンドポイントへPOSTリクエスト。
3. **Worker**: `USER_MESSAGE` イベントをPostgreSQLに保存。
4. **Worker**: OpenAI APIを呼び出し (Chat Completion)。
5. **Worker**: OpenAIからのレスポンスを受信 (トークン使用量 `usage` を含む)。
6. **Worker**: `AI_RESPONSE` イベントをPostgreSQLに保存 (トークン使用量を含む)。
7. **Worker**: React UIへJSONレスポンスを返却。

## 3. データベース設計 (Database Schema)

イベントソーシングパターンを採用し、単一の `events` テーブルに全ての履歴を保存します。

```sql
-- イベントテーブル定義
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  aggregate_id UUID NOT NULL, -- セッションID または 会話ID
  event_type VARCHAR(50) NOT NULL, -- 'USER_MESSAGE', 'AI_RESPONSE', 'SYSTEM_ERROR'など
  payload JSONB NOT NULL, -- 実際のデータ (メッセージ内容, トークン数, モデル名など)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 検索用インデックス
CREATE INDEX idx_events_aggregate_id ON events(aggregate_id);
```

### イベント定義 (Event Types & Payloads)

#### `USER_MESSAGE` (ユーザー送信)
```json
{
  "content": "こんにちは、元気ですか？",
  "role": "user"
}
```

#### `AI_RESPONSE` (AI応答)
```json
{
  "content": "はい、私はAIですので元気です。",
  "role": "assistant",
  "model": "gpt-4o",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

## 4. 実装ステップ (Implementation Checklist for Claude Code)

### Phase 1: 環境セットアップ (Environment Setup)
- [ ] `/frontend` ディレクトリに **Vite React** プロジェクトを作成。
- [ ] `/backend` ディレクトリに **Cloudflare Worker** プロジェクトを作成 (`npm create cloudflare@latest`).
- [ ] **PostgreSQL** データベースを用意し、接続情報を取得。
- [ ] `wrangler.toml` に環境変数を設定 (`DATABASE_URL`, `OPENAI_API_KEY`).

### Phase 2: データベース実装 (Database Implementation)
- [ ] スキーマ移行用SQLファイルを作成 (`schema.sql`)。
- [ ] Worker内にデータベースクライアントを実装 (`postgres` または `pg` ライブラリを使用)。
- [ ] ヘルパー関数 `appendEvent(aggregateId, type, payload)` を実装。

### Phase 3: バックエンド実装 (Backend Logic)
- [ ] `POST /api/chat` エンドポイントを作成。
- [ ] **Step 3.1**: リクエストから `conversationId` と `message` を受け取る。
- [ ] **Step 3.2**: `USER_MESSAGE` イベントをDBに保存。
- [ ] **Step 3.3**: OpenAI APIを呼び出し (履歴が必要な場合はDBから取得してContextに含める)。
- [ ] **Step 3.4**: レスポンス受信後、`usage` データを取り出す。
- [ ] **Step 3.5**: `AI_RESPONSE` イベントをDBに保存 (トークン情報込み)。
- [ ] **Step 3.6**: フロントエンドにレスポンスを返却。

### Phase 4: フロントエンド実装 (Frontend Development)
- [ ] チャットUIコンポーネントの実装 (メッセージリスト, 入力フォーム)。
- [ ] メッセージ状態管理の実装 (Hooks等)。
- [ ] API (`POST /api/chat`) との通信処理実装。
- [ ] レンダリング確認。

## 5. ディレクトリ構成案 (Directory Structure)

```text
/
├── docs/               # 設計ドキュメント (本ファイル)
├── frontend/           # React Vite App
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   └── ChatWindow.tsx
│   │   ├── hooks/
│   │   │   └── useChat.ts
│   │   └── api/
│   │       └── client.ts
│   └── ...
├── backend/            # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts    # エントリーポイント & ルーティング
│   │   ├── db.ts       # DB接続 & イベント保存ロジック
│   │   └── openai.ts   # OpenAI APIクライアント
│   ├── wrangler.toml
│   └── package.json
└── README.md
```
