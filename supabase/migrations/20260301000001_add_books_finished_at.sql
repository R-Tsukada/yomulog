-- books テーブルに finished_at カラムを追加
-- 統計機能で年月別の読了冊数・ページ数を集計するために必要

ALTER TABLE books ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- 既存の読了済み本に updated_at を埋める（代理値として使用）
UPDATE books
SET finished_at = updated_at
WHERE status = 'finished' AND finished_at IS NULL;

-- 読了日インデックス（user_id + finished_at での統計クエリ高速化）
CREATE INDEX IF NOT EXISTS idx_books_user_finished_at
  ON books (user_id, finished_at)
  WHERE finished_at IS NOT NULL;
