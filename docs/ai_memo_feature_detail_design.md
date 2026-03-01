# YomuLog AIメモ整理機能 詳細設計書
> 設計書 v2.0（yomulog_ai_design_v2）をベースに、**実際のコードベースとの整合性を確認・修正**した実装用詳細設計書

作成日: 2026-02-23
最終更新: 2026-02-23（v1.1: レビュー指摘事項を全件反映）

---

## ⚠️ 設計書 v2.0 とコードベースの不一致（重要）

実装前に必ず確認すること。以下の不一致が見つかりました。

| 設計書 v2.0 の記述 | 実際のコードベース | 対応 |
|---|---|---|
| `memos` テーブル | `reading_notes` テーブル | **設計書の `memos` は全て `reading_notes` に読み替え** |
| `memos.is_bookmarked` カラム | `reading_notes` に `is_bookmarked` カラムなし | **`is_bookmarked` カラムを `reading_notes` に追加するマイグレーションが必要** |
| `bookmarks` テーブル（お気に入りメモ）| `bookmarks` は「ページのしおり（page_number）」を管理する別テーブル | **設計書の意図する「お気に入りメモ」は `reading_notes.is_bookmarked` で実現する** |
| `books.finished_at` カラム | 存在未確認（`status='finished'` はあるが `finished_at` カラムは不明） | **Phase 2 実装前にテーブル定義を確認し、なければマイグレーション追加** |

---

## 1. 機能概要

YomuLogのAIメモ整理機能。読書中に `reading_notes` テーブルに記録したメモを Gemini Flash API で整理・要約する。メモの記述言語を自動検出し、同じ言語で整理結果を出力する（多言語対応）。

### 実装フェーズ

| フェーズ | 内容 | 本設計書の対象 |
|---|---|---|
| Phase 1 | AIメモ整理・要約機能 | ✅ 対象 |
| Phase 2 | Markdownエクスポート（Obsidian連携） | 参考記載のみ |
| Phase 3 | 月次読書レポート | 対象外 |

---

## 2. アーキテクチャ設計

### 2.1 全体構成

```text
React Native (YomuLog)
  └─ BookDetail画面
       └─ 「AIで整理する」ボタン
            │ HTTP POST /functions/v1/summarize-memos
            │ { bookId: string }  ← userIdはJWTから取得
            ▼
Supabase Edge Function (Deno)
  1. JWT検証・userId取得
  2. bookId UUID形式バリデーション
  3. レート制限チェック（books.last_summarized_at）
  4. reading_notesからメモ取得（上限制御）
  5. 言語検出 → Gemini Flash API 呼び出し（タイムアウト付き）
  6. レスポンスパース＋構造検証（フォールバック付き）
  7. book_summaries に排他制御つきupsert
  8. レスポンス返却
       ├─ Supabase DB（PostgreSQL）
       └─ Google Gemini Flash API（gemini-2.0-flash）
```

### 2.2 技術スタック

| レイヤー | 技術 | 備考 |
|---|---|---|
| クライアント | React Native + TypeScript (Expo Router) | 既存スタック |
| サーバーレス | Supabase Edge Function (Deno) | APIキー隠蔽 |
| AI API | Gemini 2.0 Flash | 無料枠あり・多言語対応 |
| DB | Supabase PostgreSQL | 既存DBを拡張 |
| 認証 | Supabase Auth JWT | 既存認証フロー |

---

## 3. データベース設計

### 3.1 既存テーブルの構造確認

#### `books` テーブル（既存）

```typescript
// components/BookDetail.tsx の型定義より
type Book = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number;
  current_page: number;
  status: string;        // 'unread' | 'reading' | 'finished'
  cover_url?: string | null;
  // user_id は存在確認済み（index.tsx で .eq('user_id', ...) を使用）
  // last_summarized_at は未存在 → マイグレーション追加が必要
  // finished_at は未確認 → Phase 2 実装前に要確認
};
```

#### `reading_notes` テーブル（既存）

```typescript
// components/NoteSection.tsx の型定義より
// ⚠️ 設計書の「memos」テーブルに相当する
type Note = {
  id: string;
  book_id: string;
  user_id: string;
  page_number: number;
  content: string;
  created_at: string;
  // is_bookmarked は未存在 → マイグレーション追加が必要
};
```

#### `bookmarks` テーブル（既存）

```typescript
// components/BookDetail.tsx の使用箇所より
// ⚠️ 設計書の「bookmarks（お気に入りメモ）」とは別物！
// これは「読書の栞（ページ位置）」を管理するテーブル
{
  book_id: string;
  user_id: string;
  page_number: number;
  recorded_at: string;  // date（YYYY-MM-DD）
}
```

### 3.2 マイグレーション一覧

実装に必要なマイグレーションを**番号順に適用する**。RLS の有効化を先に行うことで、後続のテーブル追加時もデフォルトでセキュアな状態になる。

#### Migration 1: `books` テーブルに RLS を設定

```sql
-- ⚠️ books テーブルに RLS が未設定の場合のみ実行
-- （現在の設定状況を Supabase Dashboard で確認してから適用）
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- [レビュー修正] WITH CHECK を追加（INSERT/UPDATEも保護）
CREATE POLICY "自分の書籍のみ参照可能"
  ON books
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

#### Migration 2: `reading_notes` テーブルに RLS を設定

```sql
-- ⚠️ reading_notes テーブルに RLS が未設定の場合のみ実行
ALTER TABLE reading_notes ENABLE ROW LEVEL SECURITY;

-- [レビュー修正] WITH CHECK を追加（INSERT/UPDATEも保護）
CREATE POLICY "自分のメモのみ操作可能"
  ON reading_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

#### Migration 3: `reading_notes` に `is_bookmarked` を追加

```sql
-- reading_notes に is_bookmarked カラムを追加
-- ⚠️ 設計書の memos.is_bookmarked に相当
ALTER TABLE reading_notes
  ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN NOT NULL DEFAULT false;

-- インデックス（ブックマーク済みメモの絞り込みに使用）
CREATE INDEX IF NOT EXISTS idx_reading_notes_is_bookmarked
  ON reading_notes (book_id, is_bookmarked);
```

#### Migration 4: `books` に `last_summarized_at` を追加

```sql
-- レート制限用カラム追加
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS last_summarized_at TIMESTAMPTZ;
```

#### Migration 5: `book_summaries` テーブル新規作成

```sql
CREATE TABLE IF NOT EXISTS book_summaries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary         TEXT NOT NULL,
  learnings       JSONB NOT NULL DEFAULT '[]',
  quotes          JSONB NOT NULL DEFAULT '[]',
  detected_lang   TEXT NOT NULL DEFAULT 'ja',
  prompt_version  TEXT NOT NULL DEFAULT 'v1',
  token_count     INTEGER,
  model_used      TEXT DEFAULT 'gemini-2.0-flash',
  -- raw_response は保存しない（個人情報保護・ストレージ節約）
  is_processing   BOOLEAN NOT NULL DEFAULT false,
  -- [レビュー追加] エラー時のトラッキング用
  is_error        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (book_id, user_id)
);

-- RLS有効化
ALTER TABLE book_summaries ENABLE ROW LEVEL SECURITY;

-- [レビュー修正] WITH CHECK を追加（INSERT/UPDATEも保護）
CREATE POLICY "自分のサマリーのみ操作可能"
  ON book_summaries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- [レビュー追加] updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER book_summaries_updated_at
  BEFORE UPDATE ON book_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Migration 6: モニタリング用テーブル作成

```sql
-- [レビュー修正] error_count を book_summaries.is_error から集計
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  date          DATE PRIMARY KEY,
  total_tokens  INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  error_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- pg_cron 有効化（Supabase Dashboard から有効化することも可能）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 毎日 00:05 に前日分を集計（エラー件数も含む）
SELECT cron.schedule(
  'daily-token-aggregation',
  '5 0 * * *',
  $$
    INSERT INTO ai_usage_daily (date, total_tokens, request_count, error_count)
    SELECT
      CURRENT_DATE - 1,
      COALESCE(SUM(CASE WHEN NOT is_error THEN token_count ELSE 0 END), 0),
      COUNT(*) FILTER (WHERE NOT is_error),
      COUNT(*) FILTER (WHERE is_error)
    FROM book_summaries
    WHERE updated_at >= CURRENT_DATE - 1
      AND updated_at  < CURRENT_DATE
    ON CONFLICT (date) DO UPDATE
      SET total_tokens  = EXCLUDED.total_tokens,
          request_count = EXCLUDED.request_count,
          error_count   = EXCLUDED.error_count;
  $$
);

-- [レビュー修正] ★ 必須（Phase 1 リリース前に設定）★
-- is_processing が1時間以上 true の stale lock を自動解除
SELECT cron.schedule(
  'release-stale-locks',
  '*/30 * * * *',  -- 30分ごと
  $$
    UPDATE book_summaries
    SET is_processing = false,
        is_error      = true
    WHERE is_processing = true
      AND updated_at < NOW() - INTERVAL '1 hour';
  $$
);
```

### 3.3 テーブル全体の関連図

```text
auth.users
    │
    ├─ books (user_id)
    │    ├─ reading_notes (book_id, user_id)  ← 設計書の「memos」
    │    ├─ bookmarks     (book_id, user_id)  ← ページ位置管理（設計書のbookmarksとは別物）
    │    └─ book_summaries (book_id, user_id) ← 新規作成
    │
    └─ ai_usage_daily (集計用、user_id なし)
```

---

## 4. Edge Function 設計

### 4.1 ファイル配置

```text
supabase/
  functions/
    summarize-memos/
      index.ts          ← メイン処理
    notify-usage/
      index.ts          ← Slack通知（モニタリング用）
```

### 4.2 エンドポイント仕様

| 項目 | 値 |
|---|---|
| URL | `POST /functions/v1/summarize-memos` |
| 認証 | `Authorization: Bearer {Supabase JWT}` |
| Content-Type | `application/json` |
| タイムアウト（Free Plan） | 2秒 ※**本機能は実質タイムアウトする。Pro Plan 必須** |
| タイムアウト（Pro Plan） | 150秒 |
| レート制限 | ユーザー×書籍あたり60秒に1回（`books.last_summarized_at` で制御） |
| クライアント側タイムアウト | 30秒 |

### 4.3 リクエスト・レスポンス

#### リクエストボディ

```json
{
  "bookId": "uuid-of-book"
}
```

#### レスポンス（成功時 200）

```json
{
  "summary": "この本は...",
  "learnings": ["学び1", "学び2"],
  "quotes": ["引用1"],
  "detectedLang": "ja",
  "promptVersion": "v1",
  "tokenCount": 1842,
  "createdAt": "2026-02-23T12:00:00Z"
}
```

#### エラーレスポンス一覧

全エラーは `Content-Type: application/json` で以下の形式で返す：

```json
{ "error": "error_code" }
```

| ステータス | error_code | 意味 | クライアント側の表示 |
|---|---|---|---|
| 400 | `bookId_required` | bookId未指定 | 「書籍IDが必要です」 |
| 400 | `invalid_bookId_format` | UUID形式不正 | 「無効なリクエストです」 |
| 400 | `no_memos` | メモ0件 | 「メモを追加してからAI整理できます」 |
| 400 | `invalid_json` | JSONパース失敗 | 「無効なリクエストです」 |
| 401 | `unauthorized` | JWT無効・期限切れ | 再ログインを促す |
| 403 | `not_found` | 他人のbookId / 書籍なし | 「書籍が見つかりません」 |
| 409 | `processing_in_progress` | 処理中（二重実行） | ボタンを disabled にする |
| 429 | `rate_limited` + `retryAfter` | レート制限 | 「{N}秒後に再試行できます」 |
| 500 | `internal_error` | Gemini障害・パース失敗・DB障害 | 「しばらく後に再試行してください」 |

### 4.4 完全実装コード

#### `supabase/functions/summarize-memos/index.ts`

```typescript
import { createClient } from "jsr:@supabase/supabase-js@2";

const MEMO_LIMIT         = 50;      // 送信するメモの最大件数
const CHAR_LIMIT         = 10000;   // 送信する合計文字数の上限
const RATE_LIMIT_SECONDS = 60;
const PROMPT_VERSION     = 'v1';
const GEMINI_TIMEOUT_MS  = 25000;   // [レビュー追加] Gemini API タイムアウト（25秒）

// [レビュー追加] UUID形式バリデーション用正規表現
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ==================== エラーレスポンスヘルパー ====================

// [レビュー追加] CORS ヘッダー（React Native からのリクエストに対応）
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

// [レビュー追加] 全エラーを JSON 形式で返す統一ヘルパー
function errorResponse(status: number, code: string, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ error: code, ...extra }),
    { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
  );
}

// ==================== 言語検出 ====================

function detectLanguage(notes: { content: string }[]): string {
  const sample = notes.slice(0, 5).map(m => m.content).join(' ');
  // [レビュー修正] カナのみで日本語判定（漢字を含めると中国語を誤検出するため）
  const kanaCount = (sample.match(/[\u3040-\u309F\u30A0-\u30FF]/g) ?? []).length;
  const zhCount   = (sample.match(/[\u4E00-\u9FAF]/g) ?? []).length;
  const koCount   = (sample.match(/[\uAC00-\uD7AF]/g) ?? []).length;
  const total     = sample.length || 1;

  if (kanaCount / total > 0.05) return 'ja';  // かな・カナが5%以上なら日本語
  if (koCount   / total > 0.1)  return 'ko';
  if (zhCount   / total > 0.1)  return 'zh';
  return 'en';
}

const LANG_NAMES: Record<string, string> = {
  ja: '日本語', en: 'English', zh: '中文', ko: '한국어',
};

// ==================== プロンプト構築 ====================

function buildSystemPrompt(lang: string): string {
  const langName = LANG_NAMES[lang] ?? 'the same language as the notes';
  return `
You are an AI assistant that helps organize reading notes.
Based on the user's reading notes, summarize the following 3 points.
Output MUST be in ${langName}.

【Output format】Return ONLY the following JSON. No explanation before or after.
{
  "summary": "2-3 sentence summary of the book (from the learner perspective)",
  "learnings": ["Key learning 1", "Key learning 2", ...],
  "quotes": ["Memorable quote 1", ...]
}

【Constraints】
- Do NOT alter the content of the notes
- quotes must be direct citations from the user's notes
- learnings must be insights extractable from the notes
- If information is scarce, fewer items are acceptable
`;
}

function buildUserPrompt(
  book: { title: string; author?: string | null },
  // ⚠️ 設計書の memos → 実際は reading_notes テーブルのデータ
  notes: { content: string; is_bookmarked: boolean }[]
): string {
  const noteText = notes
    .map(n => `${n.is_bookmarked ? '★' : '・'} ${n.content}`)
    .join('\n');

  return `
Book: ${book.title}
Author: ${book.author ?? 'Unknown'}

Reading notes below (★ = bookmarked / favorite):
${noteText}
`;
}

// ==================== メモの上限制御 ====================

function trimNotes(
  notes: { content: string; is_bookmarked: boolean }[],
  charLimit: number
) {
  // is_bookmarked=true のメモを先頭に並べる
  const sorted = [...notes].sort((a, b) =>
    Number(b.is_bookmarked) - Number(a.is_bookmarked)
  );

  let total = 0;
  const result = [];
  for (const note of sorted) {
    if (total + note.content.length > charLimit) break;
    total += note.content.length;
    result.push(note);
  }
  return result;
}

// ==================== Geminiレスポンス検証 ====================

// [レビュー追加] レスポンスの型を厳密に検証
function validateGeminiResult(
  parsed: unknown
): { summary: string; learnings: string[]; quotes: string[] } {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid response: not an object');
  }
  const p = parsed as Record<string, unknown>;
  if (typeof p.summary !== 'string') {
    throw new Error('Invalid response: summary must be string');
  }
  if (!Array.isArray(p.learnings)) {
    throw new Error('Invalid response: learnings must be array');
  }
  if (!Array.isArray(p.quotes)) {
    throw new Error('Invalid response: quotes must be array');
  }
  return {
    summary:   p.summary,
    learnings: p.learnings.filter((l): l is string => typeof l === 'string'),
    quotes:    p.quotes.filter((q): q is string => typeof q === 'string'),
  };
}

function safeParseGeminiResponse(text: string) {
  try { return JSON.parse(text); } catch (_) {}

  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch (_) {}
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (_) {}
  }

  return null;
}

// ==================== Gemini呼び出し ====================

async function callGeminiFlash(systemPrompt: string, userPrompt: string) {
  // [レビュー追加] GEMINI_API_KEY の存在確認（設定ミスを早期検知）
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('[summarize-memos] GEMINI_API_KEY is not set');
    throw new Error('GEMINI_API_KEY not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  // [レビュー追加] AbortController でタイムアウト制御
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error('[summarize-memos] Gemini API error:', res.status, await res.text());
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const rawText    = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const tokenCount = data.usageMetadata?.totalTokenCount ?? 0;

    const parsed = safeParseGeminiResponse(rawText);
    if (!parsed) {
      console.error('[summarize-memos] Parse failed. rawText:', rawText.slice(0, 200));
      throw new Error('Failed to parse Gemini response');
    }

    // [レビュー追加] 構造検証
    const validated = validateGeminiResult(parsed);
    return { ...validated, tokenCount };

  } finally {
    clearTimeout(timer);
  }
}

// ==================== メインハンドラ ====================

Deno.serve(async (req: Request) => {
  // [レビュー追加] CORS プリフライトレスポンス
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  // 1. JWT検証
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return errorResponse(401, 'unauthorized');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse(401, 'unauthorized');

  // 2. リクエストボディ解析
  let body: { bookId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'invalid_json');
  }

  const { bookId } = body;
  if (!bookId) return errorResponse(400, 'bookId_required');
  // [レビュー追加] UUID形式バリデーション（予期せぬDB エラー・インジェクション防止）
  if (!UUID_REGEX.test(bookId)) return errorResponse(400, 'invalid_bookId_format');

  // 3. 書籍取得（user_idフィルタ必須 ← セキュリティ上重要）
  const { data: book } = await supabase
    .from('books')
    .select('title, author, last_summarized_at')
    .eq('id', bookId)
    .eq('user_id', user.id)  // ← 必須。なければ他人の書籍が見える
    .single();

  if (!book) return errorResponse(403, 'not_found');

  // 4. レート制限チェック
  if (book.last_summarized_at) {
    const elapsed = (Date.now() - new Date(book.last_summarized_at).getTime()) / 1000;
    if (elapsed < RATE_LIMIT_SECONDS) {
      const retryAfter = Math.ceil(RATE_LIMIT_SECONDS - elapsed);
      return new Response(
        JSON.stringify({ error: 'rate_limited', retryAfter }),
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        }
      );
    }
  }

  // 5. メモ取得（上限あり）
  // ⚠️ 設計書の「memos」テーブルは実際には「reading_notes」テーブル
  const { data: notes } = await supabase
    .from('reading_notes')
    .select('content, is_bookmarked')
    .eq('book_id', bookId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MEMO_LIMIT);

  if (!notes?.length) return errorResponse(400, 'no_memos');

  // 6. 文字数上限の適用
  const trimmedNotes = trimNotes(notes, CHAR_LIMIT);

  // 7. アトミックなロック取得（is_processing フラグ）
  // [レビュー修正] TOCTOU 競合を解消するため、SELECT→判定→UPDATE ではなく
  // 「条件付き UPDATE でロック取得」→「行なしなら INSERT」の2ステップに変更

  // ステップ1: is_processing が false/null の場合のみ UPDATE でアトミックにロック取得
  const { data: locked } = await supabase
    .from('book_summaries')
    .update({ is_processing: true, is_error: false })
    .eq('book_id', bookId)
    .eq('user_id', user.id)
    .or('is_processing.is.null,is_processing.eq.false')
    .select()
    .maybeSingle();

  if (!locked) {
    // ステップ2: レコードが存在しない場合は INSERT を試みる
    const { error: insertError } = await supabase.from('book_summaries').insert({
      book_id:        bookId,
      user_id:        user.id,
      is_processing:  true,
      is_error:       false,
      summary:        '',
      learnings:      [],
      quotes:         [],
      detected_lang:  'ja',
      prompt_version: PROMPT_VERSION,
    });
    if (insertError?.code === '23505') {
      // ユニーク制約違反 = 別リクエストが先にロック取得済み
      return errorResponse(409, 'processing_in_progress');
    }
    if (insertError) {
      console.error('[summarize-memos] Failed to insert book_summary:', insertError);
      return errorResponse(500, 'db_error');
    }
  }

  try {
    // 9. 言語検出
    const detectedLang = detectLanguage(trimmedNotes);

    // 10. Gemini呼び出し（タイムアウト付き）
    const systemPrompt = buildSystemPrompt(detectedLang);
    const userPrompt   = buildUserPrompt(book, trimmedNotes);
    const geminiResult = await callGeminiFlash(systemPrompt, userPrompt);

    const result = {
      book_id:        bookId,
      user_id:        user.id,
      summary:        geminiResult.summary,
      learnings:      geminiResult.learnings,
      quotes:         geminiResult.quotes,
      detected_lang:  detectedLang,
      prompt_version: PROMPT_VERSION,
      token_count:    geminiResult.tokenCount,
      model_used:     'gemini-2.0-flash',
      is_processing:  false,
      is_error:       false,
    };

    // 11. DBに保存（[レビュー修正] onConflict を明示指定）
    const { error: upsertError } = await supabase.from('book_summaries')
      .upsert(result, { onConflict: 'book_id,user_id' });

    if (upsertError) {
      console.error('[summarize-memos] Failed to upsert book_summary:', upsertError);
      throw new Error('DB upsert failed');
    }

    // 12. last_summarized_at 更新（レート制限用）
    await supabase.from('books')
      .update({ last_summarized_at: new Date().toISOString() })
      .eq('id', bookId)
      .eq('user_id', user.id);

    return new Response(JSON.stringify({
      summary:       result.summary,
      learnings:     result.learnings,
      quotes:        result.quotes,
      detectedLang:  result.detected_lang,
      promptVersion: result.prompt_version,
      tokenCount:    result.token_count,
      createdAt:     new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });

  } catch (err) {
    // 必ず is_processing を false に戻し、is_error をセット
    await supabase.from('book_summaries')
      .update({ is_processing: false, is_error: true })
      .eq('book_id', bookId)
      .eq('user_id', user.id);
    console.error('[summarize-memos] Error:', err);
    return errorResponse(500, 'internal_error');
  }
});
```

---

## 5. フロントエンド実装方針

### 5.1 配置先ファイル

設計書では `BookDetail` 画面に「AIで整理する」ボタンを追加する。

| ファイル | 変更内容 |
|---|---|
| `app/book/[id].tsx` | `AISummarySection` コンポーネントを追加 |
| `components/AISummarySection.tsx` | 新規作成（ボタン・結果表示・エクスポート） |
| `components/NoteSection.tsx` | `is_bookmarked` フラグのトグル機能を追加 |

### 5.2 状態型定義

```typescript
// components/AISummarySection.tsx

type BookSummary = {
  summary: string;
  learnings: string[];
  quotes: string[];
  detectedLang: string;
  promptVersion: string;
  tokenCount: number;
  createdAt: string;
};

type SummaryState =
  | { status: 'idle' }
  | { status: 'loading_existing' }   // [レビュー追加] 既存サマリー取得中
  | { status: 'loading' }            // AI整理中
  | { status: 'success'; data: BookSummary }
  | { status: 'error'; message: string }
  | { status: 'rate_limited'; retryAfter: number }
  | { status: 'conflict' };
```

### 5.3 API呼び出し実装

```typescript
// components/AISummarySection.tsx

import { supabase } from '../lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const FETCH_TIMEOUT_MS = 30000; // 30秒タイムアウト

async function callSummarizeMemos(bookId: string): Promise<BookSummary> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/summarize-memos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ bookId }),
        signal: controller.signal,
      }
    );

    if (res.status === 429) {
      const body = await res.json();
      throw Object.assign(new Error('rate_limited'), { retryAfter: body.retryAfter });
    }
    if (res.status === 409) throw new Error('conflict');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// [レビュー追加] コンポーネントマウント時に既存サマリーを取得
async function fetchExistingSummary(bookId: string, userId: string): Promise<BookSummary | null> {
  const { data } = await supabase
    .from('book_summaries')
    .select('summary, learnings, quotes, detected_lang, prompt_version, token_count, updated_at')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data || data.is_processing) return null;

  return {
    summary:       data.summary,
    learnings:     data.learnings,
    quotes:        data.quotes,
    detectedLang:  data.detected_lang,
    promptVersion: data.prompt_version,
    tokenCount:    data.token_count ?? 0,
    createdAt:     data.updated_at,
  };
}
```

### 5.4 コンポーネント概要

```text
AISummarySection
  ├─ 初期表示（useEffect）: book_summaries から既存サマリーを取得
  │    └─ 存在すれば status='success' で即座に表示
  ├─ SummarizeButton（「AIで整理する」「再生成する」ボタン）
  │    └─ loading/is_processing中はdisabled
  ├─ RetryAfterBanner（429受信時のカウントダウン）
  ├─ AISummaryCard（要約・学び・引用の表示）
  │    ├─ LearningList（学び一覧）
  │    └─ QuoteList（印象的な言葉）
  └─ ExportButton（Markdownエクスポート）※Phase 2
```

### 5.5 UX考慮点

- **初期表示**: コンポーネントマウント時に `book_summaries` テーブルを確認し、既存サマリーがあれば即座に表示する（`fetchExistingSummary` 参照）
- Gemini API の応答は最大5〜10秒かかるため、ローディングスケルトンを表示する
- 一度生成した結果は `book_summaries` テーブルから取得するため、2回目以降は即座に表示
- 「再生成する」ボタンは `is_processing=true` の間は必ず `disabled`
- メモが0件の場合はボタンを `disabled` にして「メモを追加してからAI整理できます」を表示
- 429受信時は「あと{retryAfter}秒後に再試行できます」をカウントダウンで表示
- クライアント側タイムアウトは30秒で設定し、超過時は「しばらく時間をおいてください」を表示

### 5.6 NoteSection への is_bookmarked トグル追加

```typescript
// components/NoteSection.tsx への追加

const handleToggleBookmark = async (noteId: string, current: boolean) => {
  await supabase
    .from('reading_notes')
    .update({ is_bookmarked: !current })
    .eq('id', noteId)
    .eq('user_id', userId);  // user_id フィルタ必須
  onNoteAdded(); // リフレッシュ
};
```

---

## 6. 環境変数・シークレット設定

### 6.1 Supabase Edge Function シークレット

Supabase Dashboard → Project Settings → Edge Functions → Secrets で設定する。

| シークレット名 | 値 | 説明 |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio から取得 | Gemini Flash API キー |
| `SLACK_WEBHOOK_URL` | Slack から取得 | モニタリング通知用（任意） |

Supabase が自動提供するシークレット（設定不要）:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 6.2 React Native（クライアント）環境変数

`.env` ファイルに設定済みのものを利用する（新規追加不要）:
```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 7. セキュリティ・懸念点と対応策

### 7.1 [Critical] 他人の書籍データ参照（修正済 in 設計書）

**リスク**: `bookId` のみで検索すると他人の書籍タイトル・著者名が参照可能

**対応策**: Edge Function 内の全 DB クエリに `.eq('user_id', user.id)` を必ず付ける

```typescript
// NG（脆弱）
.from('books').eq('id', bookId).single()

// OK（安全）
.from('books').eq('id', bookId).eq('user_id', user.id).single()
```

**追加対策**: `books`, `reading_notes` テーブルに RLS を設定する（Migration 1, 2）

---

### 7.2 [Critical] DB の RLS 設定漏れ（修正済 in 設計書）

**リスク**: `books`・`reading_notes` に RLS が未設定の場合、Service Role Key を使うと全ユーザーのデータにアクセス可能

**対応策**:
1. Migration 1, 2 で RLS を有効化し、全ポリシーに `WITH CHECK` を設定（INSERT/UPDATE の保護）
2. Edge Function では `SUPABASE_ANON_KEY`（JWTユーザー権限）を使い、`SERVICE_ROLE_KEY` は使わない
3. Supabase Dashboard で定期的に RLS 設定を確認する

---

### 7.3 [Critical] レート制限の設計（修正済 in 設計書）

**リスク**: ステートレスな Edge Function ではメモリでのレート管理が不可。無制限に Gemini API を呼ばれるとコストが爆発する。

**対応策**: `books.last_summarized_at` を使った DB 側での制御（60秒に1回）

**注意**: `RATE_LIMIT_SECONDS = 60` は定数化されているため、変更は Edge Function の再デプロイが必要。

**既知の制限（Phase 2 以降で対応）**: 現在は書籍単位のレート制限のみ。同一ユーザーが多数の書籍で同時に整理を実行する場合の制限がない。ユーザー単位の制限（例: 1分あたり3リクエスト）は Phase 2 で `book_summaries` テーブルを集計クエリで実装する。

---

### 7.4 [Critical] is_processing デッドロック（修正済 in 設計書）

**リスク**: Edge Function がクラッシュすると `is_processing=true` のまま残り、以降の整理が永遠にできなくなる（デッドロック）

**対応策**:
1. `try/catch` の `catch` ブロックで確実に `is_processing=false` に戻す（かつ `is_error=true` をセット）
2. **pg_cron による自動解除（★ Phase 1 リリース前に必須設定 ★）**:
   ```sql
   -- 1時間以上 is_processing=true のレコードを自動解除（Migration 6 に含む）
   SELECT cron.schedule(
     'release-stale-locks',
     '*/30 * * * *',
     $$
       UPDATE book_summaries
       SET is_processing = false,
           is_error      = true
       WHERE is_processing = true
         AND updated_at < NOW() - INTERVAL '1 hour';
     $$
   );
   ```
3. 手動確認クエリ（障害対応用）:
   ```sql
   SELECT book_id, user_id, updated_at
   FROM book_summaries
   WHERE is_processing = true
     AND updated_at < NOW() - INTERVAL '1 hour';
   ```

**既知の制限**: Step 7→8 の SELECT + UPDATE には微小な競合状態（race condition）がある。同一書籍・同一ユーザーが数十ミリ秒以内に2リクエストを送った場合、両方が `is_processing=false` を確認して処理を開始する可能性がある。現実的な発生頻度は極めて低く、結果は最後に upsert した方で上書きされるため実害は軽微。本番トラフィックが増加した際は、PostgreSQL の `UPDATE ... WHERE is_processing = false RETURNING id` で原子的なロック取得に移行する。

---

### 7.5 [Critical] bookId の入力バリデーション（修正済 in 設計書）

**リスク**: UUID 形式でない文字列が `bookId` に来た場合、PostgreSQL エラーが発生するか予期せぬ動作になる

**対応策**: Edge Function でリクエスト受信直後に UUID 正規表現で検証する（§4.4 参照）

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(bookId)) return errorResponse(400, 'invalid_bookId_format');
```

---

### 7.6 [Major] Edge Function のタイムアウト

**リスク**: Supabase Free Plan の Edge Function タイムアウトは **2秒**。Gemini Flash API の応答には通常2〜5秒かかるため、**Free Plan では確実にタイムアウトする**。

**対応策**:
- 開発中: `supabase functions serve` でローカルテスト（タイムアウトなし）
- **本番公開時は Pro Plan（$25/月）へのアップグレードが必須**
- Pro Plan のタイムアウトは 150秒

---

### 7.7 [Major] Gemini API のプロンプトインジェクション

**リスク**: ユーザーのメモに「JSONを無視して...」などの悪意あるテキストが含まれる可能性

**対応策**:
1. システムプロンプトで出力形式を厳密に指定している（`Return ONLY the following JSON`）
2. `safeParseGeminiResponse` で出力をパースし、期待した構造でなければ 500 を返す
3. `validateGeminiResult` で型を厳密に検証し、unexpected な値は弾く

---

### 7.8 [Major] GEMINI_API_KEY の管理

**リスク**: API キーが漏洩すると不正利用によるコスト被害

**対応策**:
1. Supabase の Edge Function Secrets に保存（環境変数として安全に管理）
2. クライアント（React Native）には一切 API キーを持たせない
3. Google AI Studio でキーの使用量を定期確認し、異常があれば即座に再発行

---

### 7.9 [Minor] `reading_notes` の `is_bookmarked` への誤操作

**リスク**: `is_bookmarked` のトグル操作に `user_id` フィルタがないと他人のメモを変更できる

**対応策**: `reading_notes` に RLS を設定する（Migration 2）。加えてクライアント側の更新クエリにも `.eq('user_id', userId)` を付ける。

---

### 7.10 [Minor] books テーブルの `finished_at` カラム未存在

**リスク**: Phase 2 の Obsidian エクスポートで `books.finished_at` を参照しようとするとエラー

**対応策**: Phase 2 着手前に以下を確認・実施する：
1. Supabase Dashboard で `books` テーブルのカラム定義を確認
2. `finished_at` が未存在なら Migration を追加:
   ```sql
   ALTER TABLE books ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
   -- status が 'finished' になった時点で finished_at を設定するトリガーまたはアプリ側ロジックが必要
   ```

---

## 8. 実装手順（推奨順序）

### Step 1: データベースマイグレーション

Migration は番号順（1→6）に適用する。

1. Migration 1: `books` テーブルに RLS 設定（**現在の設定を確認してから**）
2. Migration 2: `reading_notes` テーブルに RLS 設定（**現在の設定を確認してから**）
3. Migration 3: `reading_notes.is_bookmarked` カラム追加
4. Migration 4: `books.last_summarized_at` カラム追加
5. Migration 5: `book_summaries` テーブル作成
6. Migration 6: `ai_usage_daily` テーブル作成・pg_cron 設定（★ stale lock 解除ジョブ含む ★）

### Step 2: Edge Function のセットアップと実装

```bash
# [レビュー追加] まず supabase CLI の初期化が必要
supabase init                                    # supabase/ ディレクトリを生成
supabase link --project-ref <プロジェクトID>     # Supabase プロジェクトと紐付け

# 関数の作成
mkdir -p supabase/functions/summarize-memos
```

1. `supabase/functions/summarize-memos/index.ts` を作成（§4.4 参照）
2. ローカルで `supabase functions serve` を使って動作確認
3. シークレット（`GEMINI_API_KEY`）を設定してデプロイ:
   ```bash
   supabase secrets set GEMINI_API_KEY=<your-key>
   supabase functions deploy summarize-memos
   ```

### Step 3: フロントエンドの実装

1. `components/NoteSection.tsx` に `is_bookmarked` トグル機能を追加
2. `components/AISummarySection.tsx` を新規作成（初期表示で既存サマリーをフェッチ）
3. `app/book/[id].tsx` に `AISummarySection` を組み込む

### Step 4: テスト

1. メモ0件 → 400（`no_memos`）が返ることを確認
2. 他人の bookId → 403（`not_found`）が返ることを確認
3. 60秒以内の再リクエスト → 429（`rate_limited` + `retryAfter`）が返ることを確認
4. 正常ケース → 要約・学び・引用が正しく返ることを確認
5. ボタン連打 → 409（`processing_in_progress`）が返り、UIが disabled になることを確認
6. UUID形式でない bookId → 400（`invalid_bookId_format`）が返ることを確認
7. 再生成ケース → 既存の要約が表示されたまま処理中表示になることを確認
8. エラー発生後 → `is_processing=false`・`is_error=true` になることを確認

### Step 5: Pro Plan へのアップグレード（本番公開前）

- Supabase Dashboard から Pro Plan にアップグレード（$25/月）
- Edge Function のタイムアウトが 150秒になることを確認

---

## 9. コスト試算

### Gemini 2.0 Flash 無料枠

| 項目 | 上限 |
|---|---|
| リクエスト数 | 1,500回/日 |
| トークン | 100万トークン/日 |
| 1分あたり制限 | 15リクエスト/分 |

1冊整理のコスト: 約7,000〜10,000トークン（1日100〜140冊相当）

**個人・少数ユーザーフェーズでは無料枠で十分**

### 有料転換後（参考）

| 規模 | Gemini 2.0 Flash | 備考 |
|---|---|---|
| 100ユーザー×月5冊 | 約50〜100円/月 | 問題なし |
| 1,000ユーザー×月5冊 | 約500〜1,000円/月 | プレミアム課金で回収可能 |

---

## 付録: v1.1 レビュー反映内容

| 分類 | 指摘 | 対応箇所 |
|---|---|---|
| バグ | upsert が再生成時に既存サマリーを消去 | §4.4 Step 8: INSERT/UPDATE 使い分け |
| バグ | upsert の onConflict 未指定 | §4.4 Step 11: `onConflict: 'book_id,user_id'` を追加 |
| バグ | detectLanguage が漢字で中国語を日本語と誤判定 | §4.4 `detectLanguage`: カナのみで判定 |
| バグ | `error_count` が常に 0 のまま | §3.2 Migration 5: `is_error` カラム追加、Migration 6 pg_cron 修正 |
| セキュリティ | bookId の UUID バリデーションなし | §4.4 Step 2: UUID_REGEX 検証追加、§7.5 新設 |
| セキュリティ | is_processing の race condition | §7.4 に既知の制限として記載・改善方針を追記 |
| セキュリティ | RLS ポリシーに WITH CHECK がない | §3.2 Migration 1, 2, 5: WITH CHECK 追加 |
| セキュリティ | ユーザー単位のレート制限なし | §7.3 に Phase 2 課題として記載 |
| 実現可能性 | Gemini API fetch にタイムアウトなし | §4.4 `callGeminiFlash`: AbortController 追加 |
| 実現可能性 | supabase init/link 手順なし | §8 Step 2 に追記 |
| 実現可能性 | 既存サマリーの初期表示設計なし | §5.2 `loading_existing` 状態、§5.3 `fetchExistingSummary` 追加 |
| 実現可能性 | CORS ヘッダー未設定 | §4.4: `CORS_HEADERS` + OPTIONS プリフライト対応追加 |
| 保守性 | マイグレーション番号が適用順と不一致 | §3.2 全マイグレーションを適用順に再採番（旧4→新1等） |
| 保守性 | GEMINI_API_KEY の null チェックなし | §4.4 `callGeminiFlash`: 早期 null チェック追加 |
| 保守性 | `updated_at` の自動更新がない | §3.2 Migration 5: トリガー追加 |
| 保守性 | Gemini レスポンスの型検証なし | §4.4: `validateGeminiResult` 関数追加 |
| 保守性 | エラーレスポンス形式が不統一 | §4.4: `errorResponse` ヘルパー関数追加、§4.3 更新 |
| 保守性 | pg_cron stale lock 解除が「任意」 | §7.4・Migration 6: Phase 1 必須に格上げ |
| その他 | §5.4 「引象的」誤字 | §5.4: 「印象的」に修正 |

---

*YomuLog AIメモ整理機能 詳細設計書 v1.1 | 2026-02-23*
