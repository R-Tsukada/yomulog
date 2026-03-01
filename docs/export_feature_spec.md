# エクスポート機能 仕様書

## 概要

本の詳細ページから、読書メモをMarkdown形式でエクスポートする機能。
他のAIツールやObsidianへの取り込みを想定している。

---

## 対象画面

`app/book/[id].tsx`（本の詳細ページ）

---

## エクスポート対象メモ

- **ブックマーク済みメモ（`is_bookmarked = true`）を優先**
- ブックマーク済みメモが1件もない場合は、**全メモを対象**にする
- メモが0件の場合は、エクスポートボタンを非活性にする

---

## メモの並び順

ページ番号（`page_number`）昇順

---

## 出力形式

### ファイル名

```
{タイトル}_{YYYY-MM-DD}.md
```

例: `ハリーポッターと賢者の石_2026-02-28.md`

- タイトルに使用不可文字（`: / \ * ? " < > |`）が含まれる場合はアンダースコア（`_`）に置換する

### Markdownの構成

```markdown
---
aliases:
  - {title}
author: {author | "Unknown"}
created: {YYYY-MM-DD}
---

# {title}

Author: {author | "Unknown"}

---

## Notes

### p.{page_number}
{note content}

### p.{page_number}
{note content}
```

- Obsidian の frontmatter（YAMLブロック）を先頭に付与する
- `aliases` にタイトルを設定することで Obsidian からリンクしやすくする
- 著者名が未設定の場合は `"Unknown"` と表示する

---

## 出力先

OSネイティブの**共有シート（Share Sheet）** を使用する（`expo-sharing`）。

- iOS: 「ファイルに保存」「コピー」「他アプリで開く」などユーザーが選択
- Android: アプリ選択ダイアログ

### 実装フロー

1. Markdownコンテンツを文字列として生成
2. 一時ファイル（`FileSystem.cacheDirectory`）に `.md` ファイルとして書き出す
3. `expo-sharing` の `shareAsync()` で共有シートを起動
4. 共有完了後、一時ファイルを削除する

### エラーハンドリング

- `shareAsync()` が失敗した場合（共有機能が利用不可など）はアラートを表示する
  - 表示メッセージ例: `"Export is not supported on this device."`

---

## UIデザイン

- エクスポートボタンを本の詳細ページに設置（位置はTBD）
- メモが0件の場合はボタンを非活性（disabled）にする
- ブックマーク済みのみエクスポートされる場合は、その旨をボタン近くに表示するか検討

---

## 依存ライブラリ

| ライブラリ | 用途 |
|---|---|
| `expo-sharing` | 共有シートの起動 |
| `expo-file-system` | 一時ファイルの書き出し・削除 |
