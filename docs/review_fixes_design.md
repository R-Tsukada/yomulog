# コードレビュー対応 実装設計書

## 概要

CodeRabbit のレビューコメント（PR #2）への対応内容をまとめる。
5件の問題に対応する。

---

## 1. NoteSection.tsx — ブックマークトグルのエラーハンドリング追加

### 問題

`handleToggleBookmark` が Supabase のエラーを無視している。エラーが発生しても
`onNoteAdded()` を呼んでしまい、UI が誤った状態になりうる。

```typescript
// 現状（エラーを捨てている）
const handleToggleBookmark = async (noteId: string, current: boolean) => {
  await supabase
    .from('reading_notes')
    .update({ is_bookmarked: !current })
    .eq('id', noteId)
    .eq('user_id', userId);
  onNoteAdded(); // エラーがあっても呼ばれる
};
```

### 修正方針

他のハンドラ（`handleAddNote`・`handleSaveEdit`・`handleDeleteConfirm`）と同じパターンに統一する。

```typescript
// 修正後
const handleToggleBookmark = async (noteId: string, current: boolean) => {
  const { error: toggleError } = await supabase
    .from('reading_notes')
    .update({ is_bookmarked: !current })
    .eq('id', noteId)
    .eq('user_id', userId);
  if (toggleError) {
    setError(toggleError.message);
  } else {
    onNoteAdded();
  }
};
```

### テストへの影響

`__tests__/NoteSection.test.tsx` に以下を追加する：
- ブックマークトグル成功時に `onNoteAdded` が呼ばれる（既存テストが通ることを確認）
- ブックマークトグル失敗時にエラーメッセージが表示され、`onNoteAdded` が呼ばれない

---

## 2. AISummarySection.tsx — fetchExistingSummary に userId を追加

### 問題

`fetchExistingSummary` が `book_id` のみでフィルタしており、`userId` を使っていない。
他ユーザーの `book_summaries` レコードが混入する可能性がある。

```typescript
// 現状（userId が未使用）
async function fetchExistingSummary(bookId: string): Promise<BookSummary | null> {
  const { data } = await supabase
    .from('book_summaries')
    .select('...')
    .eq('book_id', bookId)  // user_id フィルタがない
    .maybeSingle();
  return data;
}

useEffect(() => {
  fetchExistingSummary(bookId).then(...);
}, [bookId]);  // userId が依存配列にない
```

### 修正方針

```typescript
// 修正後
async function fetchExistingSummary(
  bookId: string,
  userId: string,
): Promise<BookSummary | null> {
  const { data } = await supabase
    .from('book_summaries')
    .select('...')
    .eq('book_id', bookId)
    .eq('user_id', userId)  // 追加
    .maybeSingle();
  return data;
}

useEffect(() => {
  fetchExistingSummary(bookId, userId).then(...);
}, [bookId, userId]);  // userId を依存配列に追加
```

### テストへの影響

`__tests__/AISummarySection.test.tsx` の `setupFetchSummaryMock` を更新する。
現状は `.eq()` が1段チェーンだが、`user_id` フィルタ追加で2段になるため以下のように変更する：

```typescript
function setupFetchSummaryMock(data: object | null) {
  const mockMaybeSingle = jest.fn().mockResolvedValue({ data, error: null });
  const mockEqUserId = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockEqBookId = jest.fn().mockReturnValue({ eq: mockEqUserId }); // 変更
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEqBookId });
  mockFrom.mockReturnValue({ select: mockSelect });
  return { mockMaybeSingle, mockEqBookId, mockEqUserId, mockSelect };
}
```

また、`user_id` でフィルタされていることを確認するテストを追加する：
- `fetchExistingSummary` が `eq('user_id', 'user-1')` を呼んでいることを検証

---

## 3. supabase/functions/summarize-memos — Gemini レスポンスのログ漏洩修正

### 問題

パース失敗時に Gemini の生レスポンス（`rawText`）をログ出力している。
ユーザーのメモ内容がログに記録されプライバシーリスクがある。

```typescript
// 現状（生データをログ出力）
if (!parsed) {
  console.error('[summarize-memos] Parse failed. rawText:', rawText.slice(0, 200));
  throw new Error('Failed to parse Gemini response');
}
```

### 修正方針

生データの代わりに、デバッグに必要なメタデータのみをログに出力する。

```typescript
// 修正後
if (!parsed) {
  // ユーザーデータを含む生テキストはログに出さない
  // デバッグ用にメタデータのみ記録
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawText));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  console.error('[summarize-memos] Parse failed.', {
    length: rawText.length,
    tokenCount,
    hash: hashHex,
  });
  throw new Error('Failed to parse Gemini response');
}
```

### テストへの影響

Edge Function のテストは現状ないため、テスト追加は対象外とする。

---

## 4. supabase/functions/summarize-memos — is_processing の競合状態修正

### 問題

現状の check-then-update フロー（TOCTOU）では、SELECT と UPDATE の間に
別リクエストが割り込む可能性がある。

```typescript
// 現状（SELECT → 判定 → UPDATE の間に競合が発生しうる）
if (existing?.is_processing) {
  return errorResponse(409, 'processing_in_progress');
}
if (existing) {
  await supabase.from('book_summaries')
    .update({ is_processing: true })
    .eq('book_id', bookId)
    .eq('user_id', user.id);
} else {
  await supabase.from('book_summaries').insert({ is_processing: true, ... });
}
```

### 修正方針

「条件付き UPDATE → ゼロ行なら INSERT → INSERT も競合なら 409」という
アトミックな2ステップに変更する。

```typescript
// ステップ1: is_processing が false/null の場合のみ UPDATE でロック取得
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
  const { error: insertError } = await supabase
    .from('book_summaries')
    .insert({
      book_id: bookId,
      user_id: user.id,
      is_processing: true,
      is_error: false,
      prompt_version: PROMPT_VERSION,
    });

  if (insertError?.code === '23505') {
    // ユニーク制約違反 = 別リクエストが先にロック取得済み
    return errorResponse(409, 'processing_in_progress');
  }
  if (insertError) {
    return errorResponse(500, 'db_error');
  }
}
// ここに到達 = ロック取得成功。Gemini 呼び出しへ進む
```

> **実装時注意：** INSERT のフィールドは既存コードの else ブランチと同じものを使うこと。
> `book_summaries` テーブルに NOT NULL カラムがあれば省略すると失敗する。

**ポイント：**
- UPDATE の WHERE 条件 (`is_processing IS NULL OR is_processing = false`) 自体がアトミックなロック取得として機能する
- INSERT 時のユニーク制約エラー（`23505`）は「他リクエストが同時にロックを取得した」ことを意味するため 409 を返す

### テストへの影響

Edge Function のテストは現状ないため、テスト追加は対象外とする。

---

## 5. Markdown lint 修正（MD040）

### 問題

`CLAUDE.md` と `docs/ai_memo_feature_detail_design.md` のコードブロックで
言語識別子が抜けている。

### 修正方針

#### CLAUDE.md

| 行 | 現状 | 修正後 |
|---|---|---|
| 41行目 | ```` ``` ```` | ```` ```text ```` |
| 87行目付近 | ```` ``` ```` | ```` ```env ```` |

#### docs/ai_memo_feature_detail_design.md

| 行 | 現状 | 修正後 |
|---|---|---|
| 40行目 | ```` ``` ```` | ```` ```text ```` |
| 130行目付近（SQL） | ```` ``` ```` | ```` ```sql ```` |
| 145行目付近（SQL） | ```` ``` ```` | ```` ```sql ```` |
| 159行目付近（SQL） | ```` ``` ```` | ```` ```sql ```` |
| 174行目付近（SQL） | ```` ``` ```` | ```` ```sql ```` |
| 280行目付近 | ```` ``` ```` | ```` ```text ```` |
| 297行目付近 | ```` ``` ```` | ```` ```text ```` |
| 864行目付近 | ```` ``` ```` | ```` ```text ```` |
| 923行目付近（bash） | ```` ``` ```` | ```` ```bash ```` |

### テストへの影響

なし

---

## 実装順序

| 順序 | 対象 | 理由 |
|---|---|---|
| 1 | `NoteSection.tsx` | 現在表示中の機能・ユーザー影響あり |
| 2 | `AISummarySection.tsx` | 再有効化時に必要なセキュリティ修正 |
| 3 | `supabase/functions` ログ修正 | プライバシーリスク（比較的シンプルな修正） |
| 4 | `supabase/functions` 競合状態修正 | プライバシーリスク（ロジック変更を伴う） |
| 5 | Markdown lint | 影響範囲が小さく最後でよい |

NoteSection の修正のみ TDD で対応する（テストが存在するため）。
その他はテストがないため、コードを直接修正する。
