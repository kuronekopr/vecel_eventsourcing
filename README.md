# Vecel Eventsourcing Chatbot

Event Sourcing と CQRS アーキテクチャを採用した、Next.js + Neon (PostgreSQL) + OpenAI のチャットボットアプリケーションです。

## 特徴

*   **Event Sourcing**: 全ての会話履歴を「イベント」として不変に保存（`events` テーブル）。
*   **CQRS**: 読み取り専用の最適化されたテーブル（`conversation_states`）を使用し、高速なレスポンスを実現。
*   **Token Tracking**: OpenAI APIのトークン使用量を正確に記録。

## スタック

*   **Frontend**: React, TailwindCSS
*   **Backend**: Next.js App Router (Serverless Functions)
*   **Database**: Neon (Serverless PostgreSQL)
*   **AI**: OpenAI API

## セットアップ (ローカル開発)

1.  **環境変数の設定**:
    `.env.example` をコピーして `.env.local` を作成します。
    ```bash
    cp .env.example .env.local
    ```
    以下の変数を設定してください：
    *   `OPENAI_API_KEY`: OpenAIのAPIキー
    *   `DATABASE_URL`: Neonの接続文字列 (`postgres://...`)

2.  **データベースの準備**:
    NeonのSQLエディタ等で、`scripts/migrate.sql` を実行してテーブルを作成します。

3.  **開発サーバーの起動**:
    ```bash
    npm run dev
    ```

## デプロイ (Vercel)

1.  [Vercel Dashboard](https://vercel.com/dashboard) からこのリポジトリをインポートします。
2.  **Environment Variables** に以下を設定します（`.env.local` の内容はアップロードされません）：
    *   `OPENAI_API_KEY`
    *   `DATABASE_URL`
3.  Deployボタンを押してデプロイします。
