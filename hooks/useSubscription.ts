import { useEffect, useState } from 'react';
import Purchases from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const PREMIUM_ENTITLEMENT_ID = 'premium';

type SubscriptionStatus =
  | { status: 'loading' }
  | { status: 'subscribed' }
  | { status: 'not_subscribed' };

export function useSubscription() {
  const { session } = useAuth();
  const [state, setState] = useState<SubscriptionStatus>({ status: 'loading' });

  const checkSubscription = async () => {
    if (!session?.user?.id) {
      setState({ status: 'not_subscribed' });
      return;
    }

    try {
      // RevenueCat を第一ソースとして確認
      const customerInfo = await Purchases.getCustomerInfo();
      const isActive = !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];

      // Supabase の user_profiles に同期（バックグラウンドで実施、失敗しても無視）
      supabase.from('user_profiles').upsert(
        { user_id: session.user.id, is_subscribed: isActive },
        { onConflict: 'user_id' }
      ).then(({ error }) => {
        if (error) {
          console.warn('[useSubscription] Failed to sync to Supabase:', error);
        }
      });

      setState({ status: isActive ? 'subscribed' : 'not_subscribed' });
    } catch (err) {
      console.warn('[useSubscription] RevenueCat error, falling back to Supabase:', err);

      // RevenueCat が失敗したら Supabase をフォールバックとして使う
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('is_subscribed')
          .eq('user_id', session.user.id)
          .eq('is_subscribed', true)
          .maybeSingle();

        setState({ status: data ? 'subscribed' : 'not_subscribed' });
      } catch {
        setState({ status: 'not_subscribed' });
      }
    }
  };

  useEffect(() => {
    if (!session?.user?.id) {
      setState({ status: 'not_subscribed' });
      return;
    }

    setState({ status: 'loading' });
    checkSubscription();

    // RevenueCat からのリアルタイム更新を受信
    // Expo Go など未初期化環境では undefined が返る場合があるため optional chaining を使用
    const listener = Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      const isActive = !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
      setState({ status: isActive ? 'subscribed' : 'not_subscribed' });
    });

    return () => {
      listener?.remove();
    };
  }, [session?.user?.id]);

  return {
    state,
    isSubscribed: state.status === 'subscribed',
    isLoading: state.status === 'loading',
    refresh: checkSubscription,
  };
}
