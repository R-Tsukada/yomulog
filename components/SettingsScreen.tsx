import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

type Props = {
  email: string;
};

const MENU_ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'person-outline', label: 'Edit Profile' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'color-palette-outline', label: 'Theme' },
  { icon: 'share-outline', label: 'Export Data' },
  { icon: 'help-circle-outline', label: 'Help' },
  { icon: 'document-text-outline', label: 'Terms of Service' },
];

export default function SettingsScreen({ email }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    setError('');
    setLoading(true);

    const { error: signOutError } = await supabase.auth.signOut();

    setLoading(false);

    if (signOutError) {
      setError(signOutError.message);
    }
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <Text className="text-2xl font-bold text-text-primary mb-6">Settings</Text>

      {/* Profile Section */}
      <View className="flex-row items-center gap-3 pb-5 mb-2 border-b border-border-light">
        <View className="w-14 h-14 rounded-2xl bg-primary items-center justify-center">
          <Ionicons name="person" size={28} color="#ffffff" />
        </View>
        <View>
          <Text className="text-base font-bold text-text-primary">Account</Text>
          <Text className="text-base text-text-secondary">{email}</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View className="py-2">
        {MENU_ITEMS.map((item, i) => (
          <TouchableOpacity
            key={i}
            className="flex-row items-center gap-3 py-3.5"
          >
            <Ionicons name={item.icon} size={22} color="#93a5b6" />
            <Text className="flex-1 text-base text-text-primary">{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#93a5b6" />
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <Text className="text-sm text-danger text-center mb-4 bg-red-50 p-3 rounded-lg">
          {error}
        </Text>
      ) : null}

      {/* Logout */}
      <View className="pt-3 border-t border-border-light mt-2">
        <TouchableOpacity
          onPress={handleLogout}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Log Out"
          className="rounded-xl p-4 items-center border border-danger"
        >
          {loading ? (
            <ActivityIndicator color="#ef4444" size="small" />
          ) : (
            <Text className="text-danger text-base font-bold">Log Out</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Version */}
      <View className="py-4 items-center">
        <Text className="text-xs text-text-secondary opacity-60">YomuLog v1.0.0</Text>
      </View>
    </ScrollView>
  );
}
