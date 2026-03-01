import "../global.css";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import { View, ActivityIndicator } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

const REVENUECAT_API_KEY = {
  ios:     process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY     ?? '',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
};

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // RevenueCat 初期化（アプリ起動時に一度だけ）
  useEffect(() => {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY.ios : REVENUECAT_API_KEY.android;
    if (apiKey) {
      Purchases.configure({ apiKey });
    }
  }, []);

  // ユーザーログイン時に RevenueCat とユーザー ID を紐付け
  useEffect(() => {
    if (session?.user?.id) {
      Purchases.logIn(session.user.id).catch((err) => {
        console.warn('[RevenueCat] logIn failed:', err);
      });
    } else {
      // ログアウト時は RevenueCat の匿名ユーザーに戻す
      Purchases.logOut().catch((err) => {
        console.warn('[RevenueCat] logOut failed:', err);
      });
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      // Not logged in → redirect to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      // Logged in → redirect to home
      router.replace("/(tabs)");
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-main">
        <ActivityIndicator size="large" color="#3ea8ff" />
      </View>
    );
  }

  return <Slot />;
}
