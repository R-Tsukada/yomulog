-- user_profiles テーブルを作成
-- サブスクリプション状態のキャッシュ（RevenueCat Webhook で更新）

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_expires_at TIMESTAMPTZ,
  revenuecat_user_id TEXT,
  plan_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- RLS を有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 自分のプロフィールのみ操作可能
CREATE POLICY "自分のプロフィールのみ操作可能"
  ON user_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();
