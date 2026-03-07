import { createClient } from "jsr:@supabase/supabase-js@2";

// RevenueCat から送られてくる Webhook イベント種別
const SUBSCRIBE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
]);

const UNSUBSCRIBE_EVENTS = new Set([
  'EXPIRATION',
  'BILLING_ISSUE',
]);

// CANCELLATION は解約申請だが、期限まで有効なので is_subscribed は変更しない

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  // ==================== 認証 ====================

  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET is not set');
    return jsonResponse(500, { error: 'internal_error' });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const incomingSecret = authHeader.replace('Bearer ', '');

  // タイミング攻撃対策: crypto.subtle.timingSafeEqual で比較
  const encoder = new TextEncoder();
  const expected = encoder.encode(webhookSecret);
  const incoming = encoder.encode(incomingSecret);

  let isValid = expected.length === incoming.length;
  if (isValid) {
    try {
      const [expectedHmac, incomingHmac] = await Promise.all([
        crypto.subtle.digest('SHA-256', expected),
        crypto.subtle.digest('SHA-256', incoming),
      ]);
      const expectedArr = new Uint8Array(expectedHmac);
      const incomingArr = new Uint8Array(incomingHmac);
      isValid = expectedArr.every((b, i) => b === incomingArr[i]);
    } catch {
      isValid = false;
    }
  }

  if (!isValid) {
    return jsonResponse(401, { error: 'unauthorized' });
  }

  // ==================== ボディ解析 ====================

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'invalid_json' });
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return jsonResponse(400, { error: 'missing_event' });
  }

  const eventType = event.type as string | undefined;
  const appUserId = event.app_user_id as string | undefined;

  if (!eventType || !appUserId) {
    return jsonResponse(400, { error: 'missing_required_fields' });
  }

  const userHashBytes = await crypto.subtle.digest('SHA-256', encoder.encode(appUserId));
  const userHash = Array.from(new Uint8Array(userHashBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8);
  console.log('[revenuecat-webhook] event:', eventType, 'user_hash:', userHash);

  // ==================== Supabase クライアント（Service Role） ====================

  const supabaseUrl      = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[revenuecat-webhook] Missing Supabase env vars');
    return jsonResponse(500, { error: 'internal_error' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ==================== user_profiles 更新 ====================

  try {
    if (SUBSCRIBE_EVENTS.has(eventType)) {
      // 購読開始・更新・復活
      const expiresAt = event.expiration_at_ms
        ? new Date(event.expiration_at_ms as number).toISOString()
        : null;

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id:                  appUserId,
          is_subscribed:            true,
          subscription_expires_at:  expiresAt,
          revenuecat_user_id:       appUserId,
          plan_type:                event.product_id as string ?? null,
          updated_at:               new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[revenuecat-webhook] DB upsert error:', error);
        return jsonResponse(500, { error: 'db_error' });
      }

    } else if (UNSUBSCRIBE_EVENTS.has(eventType)) {
      // サブスク失効
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id:                  appUserId,
          is_subscribed:            false,
          subscription_expires_at:  null,
          updated_at:               new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[revenuecat-webhook] DB upsert error:', error);
        return jsonResponse(500, { error: 'db_error' });
      }

    } else if (eventType === 'CANCELLATION') {
      // 解約申請（期限まで有効なので is_subscribed は変更しない）
      // upsert ではなく update を使うことで、行が存在しない場合の誤 INSERT を防ぐ
      const expiresAt = event.expiration_at_ms
        ? new Date(event.expiration_at_ms as number).toISOString()
        : null;

      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_expires_at:  expiresAt,
          updated_at:               new Date().toISOString(),
        })
        .eq('user_id', appUserId);

      if (error) {
        console.error('[revenuecat-webhook] DB upsert error:', error);
        return jsonResponse(500, { error: 'db_error' });
      }

    } else {
      // 対象外イベントは無視して 200 を返す
      console.log('[revenuecat-webhook] Unhandled event type, skipping:', eventType);
    }

    return jsonResponse(200, { received: true });

  } catch (err) {
    console.error('[revenuecat-webhook] Unexpected error:', err);
    return jsonResponse(500, { error: 'internal_error' });
  }
});
