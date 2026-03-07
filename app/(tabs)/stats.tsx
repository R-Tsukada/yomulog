import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Purchases from 'react-native-purchases';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { aggregateByYear, getAvailableYears, FinishedBook } from '../../utils/statsUtils';

const CURRENT_YEAR = new Date().getFullYear();

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function StatsScreen() {
  const { session } = useAuth();
  const { isLoading: subLoading, isSubscribed, refresh: refreshSub } = useSubscription();

  const [books, setBooks]         = useState<FinishedBook[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!isSubscribed || !session?.user?.id) return;

    setDataLoading(true);
    supabase
      .from('books')
      .select('id, total_pages, finished_at')
      .eq('user_id', session.user.id)
      .eq('status', 'finished')
      .not('finished_at', 'is', null)
      .then(({ data, error }) => {
        setDataLoading(false);
        if (error) {
          console.error('[StatsScreen] Failed to fetch books:', error);
          return;
        }
        setBooks((data ?? []) as FinishedBook[]);
      });
  }, [isSubscribed, session?.user?.id]);

  const availableYears = getAvailableYears(books, CURRENT_YEAR);
  const stats = aggregateByYear(books, selectedYear);

  const handlePurchase = async () => {
    try {
      setPurchasing(true);
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      if (!current?.monthly) {
        Alert.alert('エラー', '購入情報を取得できませんでした。しばらく後に再試行してください。');
        return;
      }
      await Purchases.purchasePackage(current.monthly);
      await refreshSub();
    } catch (err: any) {
      if (!err.userCancelled) {
        Alert.alert('エラー', '購入処理中にエラーが発生しました。');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setPurchasing(true);
      await Purchases.restorePurchases();
      await refreshSub();
    } catch {
      Alert.alert('エラー', '購入の復元に失敗しました。');
    } finally {
      setPurchasing(false);
    }
  };

  if (subLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main">
        <View testID="stats-loading" className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3ea8ff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isSubscribed) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4 pt-6">
          <Text className="text-2xl font-bold text-text-primary mb-6">読書統計</Text>

          <View testID="stats-paywall" className="flex-1 items-center px-2">
            <Text className="text-5xl mb-4">📊</Text>
            <Text className="text-xl font-bold text-text-primary mb-2 text-center">
              プレミアム限定機能
            </Text>
            <Text className="text-sm text-text-secondary text-center mb-8">
              サブスクリプションに登録すると、読書の統計情報を確認できます
            </Text>

            <View className="w-full bg-bg-sub rounded-xl p-4 mb-6">
              <Text className="text-sm font-semibold text-text-primary mb-3">含まれる機能</Text>
              <Text className="text-sm text-text-secondary mb-2">・年間・月別の読了冊数</Text>
              <Text className="text-sm text-text-secondary mb-2">・累計読了ページ数</Text>
              <Text className="text-sm text-text-secondary">・年ごとの推移確認</Text>
            </View>

            <TouchableOpacity
              onPress={handlePurchase}
              disabled={purchasing}
              accessibilityRole="button"
              accessibilityLabel="購読する"
              className="w-full bg-primary rounded-xl py-4 items-center mb-3"
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white font-bold text-base">購読する</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRestore}
              disabled={purchasing}
              accessibilityRole="button"
              accessibilityLabel="購入を復元する"
              className="w-full py-3 items-center"
            >
              <Text className="text-sm text-text-secondary">購入を復元する</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-main">
      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-text-primary mb-6">読書統計</Text>

        {dataLoading ? (
          <ActivityIndicator size="large" color="#3ea8ff" />
        ) : (
          <View testID="stats-content">
            {/* 年ナビゲーション */}
            <View className="flex-row items-center justify-center mb-6">
              <TouchableOpacity
                onPress={() => setSelectedYear((y) => Math.max(y - 1, availableYears[0]))}
                disabled={selectedYear <= availableYears[0]}
                className="px-4 py-2"
                accessibilityRole="button"
                accessibilityLabel="前の年"
              >
                <Text className={`text-xl font-bold ${selectedYear <= availableYears[0] ? 'text-text-secondary/40' : 'text-text-primary'}`}>
                  ‹
                </Text>
              </TouchableOpacity>

              <Text className="text-xl font-bold text-text-primary w-20 text-center">
                {selectedYear}
              </Text>

              <TouchableOpacity
                onPress={() => setSelectedYear((y) => Math.min(y + 1, CURRENT_YEAR))}
                disabled={selectedYear >= CURRENT_YEAR}
                className="px-4 py-2"
                accessibilityRole="button"
                accessibilityLabel="次の年"
              >
                <Text className={`text-xl font-bold ${selectedYear >= CURRENT_YEAR ? 'text-text-secondary/40' : 'text-text-primary'}`}>
                  ›
                </Text>
              </TouchableOpacity>
            </View>

            {/* 年間サマリー */}
            <View className="flex-row gap-3 mb-6">
              <View className="flex-1 bg-bg-sub rounded-xl p-4 items-center">
                <Text className="text-2xl font-bold text-primary">{stats.totalCount}冊</Text>
                <Text className="text-xs text-text-secondary mt-1">年間読了冊数</Text>
              </View>
              <View className="flex-1 bg-bg-sub rounded-xl p-4 items-center">
                <Text className="text-2xl font-bold text-primary">{stats.totalPages}p</Text>
                <Text className="text-xs text-text-secondary mt-1">累計ページ数</Text>
              </View>
            </View>

            {/* 月別テーブル */}
            <View className="bg-bg-sub rounded-xl overflow-hidden">
              <View className="flex-row bg-border-light px-4 py-2">
                <Text className="flex-1 text-xs font-semibold text-text-secondary">月</Text>
                <Text className="w-16 text-xs font-semibold text-text-secondary text-right">冊数</Text>
                <Text className="w-20 text-xs font-semibold text-text-secondary text-right">ページ数</Text>
              </View>
              {stats.monthly.map((m) => (
                <View
                  key={m.month}
                  className="flex-row px-4 py-3 border-b border-border-light last:border-0"
                >
                  <Text className="flex-1 text-sm text-text-primary">{MONTH_LABELS[m.month - 1]}</Text>
                  <Text className="w-16 text-sm text-text-primary text-right">
                    {m.count > 0 ? `${m.count}冊` : '-'}
                  </Text>
                  <Text className="w-20 text-sm text-text-primary text-right">
                    {m.pages > 0 ? `${m.pages}p` : '-'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
